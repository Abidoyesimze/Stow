import {
  Inject,
  Logger,
  OnModuleDestroy,
  Optional,
  forwardRef,
} from '@nestjs/common';
import { AnalyticsService } from '../analytics/analytics.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { OddsBroadcasterService } from './odds-broadcaster.service';

interface AuthenticatedSocket extends Socket {
  userAddress?: string;
}

/** UUID v4 pattern used to validate market room subscriptions. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@WebSocketGateway({
  cors: { origin: '*', credentials: true },
  namespace: '/ws',
})
export class EventsGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);
  private readonly connections = new Map<string, string>(); // socketId → userAddress
  private readonly rateLimits = new Map<string, number>(); // socketId → message count
  private readonly heartbeats = new Map<string, NodeJS.Timeout>();
  /** Tracks which market rooms each socket has subscribed to for cleanup on disconnect. */
  private readonly socketMarkets = new Map<string, Set<string>>(); // socketId → Set<marketId>
  private readonly RATE_LIMIT = 60; // messages per minute
  private readonly RATE_WINDOW = 60_000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(forwardRef(() => AnalyticsService))
    private readonly analyticsService: AnalyticsService,
    @Optional() private readonly oddsBroadcaster?: OddsBroadcasterService,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token =
      (client.handshake.auth?.token as string) ||
      (client.handshake.headers?.authorization as string)?.replace(
        'Bearer ',
        '',
      );

    if (token) {
      try {
        const payload = this.jwtService.verify<{ sub: string }>(token, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        client.userAddress = payload.sub;
        this.connections.set(client.id, payload.sub);
        await client.join(`user:${payload.sub}`);
        this.logger.log(`Client connected: ${client.id} (${payload.sub})`);
      } catch {
        this.logger.warn(`Client connected unauthenticated: ${client.id}`);
      }
    } else {
      this.logger.log(`Client connected unauthenticated: ${client.id}`);
    }

    // Heartbeat
    // In Jest/unit test runs we don't want to keep background intervals alive,
    // which can cause test processes to hang until CI timeout.
    const isTestRun =
      process.env.NODE_ENV === 'test' || Boolean(process.env.JEST_WORKER_ID);

    if (!isTestRun) {
      const heartbeat = setInterval(() => {
        client.emit('ping');
      }, 25_000);
      heartbeat.unref?.();
      this.clearHeartbeat(client.id);
      this.heartbeats.set(client.id, heartbeat);

      client.on('pong', () => {
        this.trackActivity(client);
        this.logger.debug(`Pong from ${client.id}`);
      });

      client.on('disconnect', () => this.clearHeartbeat(client.id));
    }

    this.trackActivity(client);
  }

  private trackActivity(client: AuthenticatedSocket): void {
    this.analyticsService.trackActiveSession(client.id);
    this.broadcastActiveUsers();
  }

  private broadcastActiveUsers(): void {
    const count = this.analyticsService.getActiveUsersCount();
    this.server.emit('analytics:active-users', { count });
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    this.clearHeartbeat(client.id);
    this.connections.delete(client.id);
    this.rateLimits.delete(client.id);
    this.analyticsService.removeActiveSession(client.id);
    this.broadcastActiveUsers();

    // Unsubscribe the socket from all market rooms it had joined.
    const markets = this.socketMarkets.get(client.id);
    if (markets) {
      for (const marketId of markets) {
        this.oddsBroadcaster?.onUnsubscribe(marketId);
      }
      this.socketMarkets.delete(client.id);
    }

    this.logger.log(`Client disconnected: ${client.id}`);
  }

  onModuleDestroy(): void {
    for (const heartbeat of this.heartbeats.values()) {
      clearInterval(heartbeat);
    }
    this.heartbeats.clear();
    this.socketMarkets.clear();
  }

  @SubscribeMessage('join')
  async handleJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() room: string,
  ): Promise<void> {
    if (!this.checkRateLimit(client.id)) {
      client.emit('error', { message: 'Rate limit exceeded' });
      client.disconnect();
      return;
    }

    // Validate room format
    if (
      !room ||
      (!/^(event|match):\d+$/.test(room) && !/^user:[A-Z0-9]{56}$/.test(room))
    ) {
      client.emit('error', { message: 'Invalid room' });
      return;
    }

    // User rooms require authentication
    if (room.startsWith('user:') && client.userAddress !== room.split(':')[1]) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    await client.join(room);
    client.emit('joined', { room });
    this.logger.debug(`${client.id} joined ${room}`);
    this.trackActivity(client);
  }

  @SubscribeMessage('leave')
  async handleLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() room: string,
  ): Promise<void> {
    await client.leave(room);
    client.emit('left', { room });
    this.trackActivity(client);
  }

  @SubscribeMessage('notification:delivered')
  handleNotificationDelivered(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { notification_id: number },
  ): void {
    if (!client.userAddress) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }
    // Emit event for notification broadcaster to handle
    this.server.emit('internal:notification:confirmed', {
      user_address: client.userAddress,
      notification_id: data.notification_id,
    });
    this.trackActivity(client);
  }

  private checkRateLimit(socketId: string): boolean {
    const count = this.rateLimits.get(socketId) ?? 0;
    if (count >= this.RATE_LIMIT) return false;
    this.rateLimits.set(socketId, count + 1);
    if (count === 0) {
      const timeout = setTimeout(
        () => this.rateLimits.delete(socketId),
        this.RATE_WINDOW,
      );
      timeout.unref?.();
    }
    return true;
  }

  private clearHeartbeat(socketId: string): void {
    const heartbeat = this.heartbeats.get(socketId);
    if (!heartbeat) return;
    clearInterval(heartbeat);
    this.heartbeats.delete(socketId);
  }

  // ---------------------------------------------------------------------------
  // Live odds subscription handlers (#1361)
  // ---------------------------------------------------------------------------

  /**
   * Join a per-market odds room.
   *
   * Client sends: `{ event: 'subscribe:market', data: '<market-uuid>' }`
   * Server responds with: `{ event: 'subscribed:market', data: { market_id } }`
   * and starts delivering `odds:update` events to the room.
   */
  @SubscribeMessage('subscribe:market')
  async handleSubscribeMarket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() marketId: string,
  ): Promise<void> {
    if (!this.checkRateLimit(client.id)) {
      client.emit('error', { message: 'Rate limit exceeded' });
      client.disconnect();
      return;
    }

    if (!marketId || !UUID_RE.test(marketId)) {
      client.emit('error', { message: 'Invalid market id' });
      return;
    }

    const room = `market:${marketId}`;
    await client.join(room);

    // Track this subscription on the socket for disconnect cleanup.
    if (!this.socketMarkets.has(client.id)) {
      this.socketMarkets.set(client.id, new Set());
    }
    const markets = this.socketMarkets.get(client.id)!;

    // Only register with the broadcaster once per socket per market.
    if (!markets.has(marketId)) {
      markets.add(marketId);
      this.oddsBroadcaster?.onSubscribe(marketId);
    }

    client.emit('subscribed:market', { market_id: marketId });
    this.logger.debug(`${client.id} subscribed to market:${marketId}`);
    this.trackActivity(client);
  }

  /**
   * Leave a per-market odds room.
   *
   * Client sends: `{ event: 'unsubscribe:market', data: '<market-uuid>' }`
   * Server responds with: `{ event: 'unsubscribed:market', data: { market_id } }`
   */
  @SubscribeMessage('unsubscribe:market')
  async handleUnsubscribeMarket(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() marketId: string,
  ): Promise<void> {
    if (!marketId || !UUID_RE.test(marketId)) {
      client.emit('error', { message: 'Invalid market id' });
      return;
    }

    const room = `market:${marketId}`;
    await client.leave(room);

    const markets = this.socketMarkets.get(client.id);
    if (markets?.has(marketId)) {
      markets.delete(marketId);
      this.oddsBroadcaster?.onUnsubscribe(marketId);
      if (markets.size === 0) {
        this.socketMarkets.delete(client.id);
      }
    }

    client.emit('unsubscribed:market', { market_id: marketId });
    this.logger.debug(`${client.id} unsubscribed from market:${marketId}`);
    this.trackActivity(client);
  }

  getServer(): Server {
    return this.server;
  }
}
