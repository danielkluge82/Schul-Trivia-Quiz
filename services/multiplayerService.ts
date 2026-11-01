import { Peer, DataConnection } from 'peerjs';
import { LobbyPlayer, MultiplayerMessageType } from '../types/multiplayer';

const INITIAL_COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B'];
const APP_PREFIX = 'strivia_';

export interface MultiplayerServiceCallbacks {
  onStatusChange?: (status: string) => void;
  onError?: (errorMessage: string) => void;
  onLobbyUpdate?: (players: LobbyPlayer[]) => void;
  onMessage?: (message: MultiplayerMessageType) => void;
  onConnectionSuccess?: (assignedId: number, isHost: boolean) => void;
}

export class MultiplayerService {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private hostConnection: DataConnection | null = null;
  private isHost: boolean = false;
  private myPlayerId: number = 0;
  private roomCode: string = '';
  private lobbyPlayers: LobbyPlayer[] = [];
  private callbacks: MultiplayerServiceCallbacks = {};

  constructor(callbacks: MultiplayerServiceCallbacks) {
    this.callbacks = callbacks;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getMyPlayerId(): number {
    return this.myPlayerId;
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getLobbyPlayers(): LobbyPlayer[] {
    return this.lobbyPlayers;
  }

  /**
   * Host creates a new room
   */
  public createRoom(hostName: string, hostGrade: number, requestedCode?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.isHost = true;
      this.myPlayerId = 0;

      // Generate a clean 6-character room code like "QUIZ82" or "TRIV94"
      const randomDigits = Math.floor(1000 + Math.random() * 9000);
      const code = requestedCode ? requestedCode.toUpperCase().trim() : `QUIZ${randomDigits}`;
      this.roomCode = code;
      const fullPeerId = `${APP_PREFIX}${code.toLowerCase()}`;

      this.callbacks.onStatusChange?.('Verbinde mit öffentlichem Vermittlungsserver...');

      try {
        this.peer = new Peer(fullPeerId, {
          debug: 1
        });

        this.peer.on('open', (id) => {
          this.lobbyPlayers = [
            {
              id: 0,
              name: hostName.trim() || 'Host',
              grade: hostGrade,
              peerId: id,
              isHost: true,
              color: INITIAL_COLORS[0],
            },
          ];
          this.callbacks.onStatusChange?.(`Raum ${code} bereit! Warte auf Mitspieler...`);
          this.callbacks.onLobbyUpdate?.(this.lobbyPlayers);
          this.callbacks.onConnectionSuccess?.(0, true);
          resolve(code);
        });

        this.peer.on('connection', (conn) => {
          this.handleIncomingConnection(conn);
        });

        this.peer.on('error', (err: any) => {
          if (err.type === 'unavailable-id') {
            // Room code already taken, retry with random code
            const newDigits = Math.floor(1000 + Math.random() * 9000);
            this.createRoom(hostName, hostGrade, `QUIZ${newDigits}`).then(resolve).catch(reject);
          } else {
            this.callbacks.onError?.(`Netzwerkfehler: ${err.message || err.type}`);
            reject(err);
          }
        });
      } catch (e: any) {
        this.callbacks.onError?.(`Initialisierungsfehler: ${e.message}`);
        reject(e);
      }
    });
  }

  /**
   * Guest joins an existing room
   */
  public joinRoom(roomCode: string, guestName: string, guestGrade: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.disconnect();
      this.isHost = false;
      const cleanCode = roomCode.toUpperCase().trim();
      this.roomCode = cleanCode;
      const targetHostId = `${APP_PREFIX}${cleanCode.toLowerCase()}`;

      this.callbacks.onStatusChange?.('Verbinde mit Vermittlungsserver...');

      try {
        this.peer = new Peer({
          debug: 1
        });

        this.peer.on('open', () => {
          this.callbacks.onStatusChange?.(`Verbinde mit Host (Raum ${cleanCode})...`);
          
          const conn = this.peer!.connect(targetHostId, {
            reliable: true,
          });

          this.hostConnection = conn;

          conn.on('open', () => {
            this.callbacks.onStatusChange?.('Verbunden mit Raum! Warte auf Freigabe...');
            // Send join request
            conn.send({
              type: 'JOIN_REQUEST',
              name: guestName.trim() || 'Gast',
              grade: guestGrade,
            } as MultiplayerMessageType);
          });

          conn.on('data', (data: any) => {
            const msg = data as MultiplayerMessageType;
            if (msg.type === 'JOIN_ACCEPTED') {
              this.myPlayerId = msg.assignedId;
              this.lobbyPlayers = msg.players;
              this.callbacks.onStatusChange?.(`Erfolgreich beigetreten als Spieler ${msg.assignedId + 1}!`);
              this.callbacks.onLobbyUpdate?.(msg.players);
              this.callbacks.onConnectionSuccess?.(msg.assignedId, false);
              resolve();
            } else if (msg.type === 'LOBBY_UPDATE') {
              this.lobbyPlayers = msg.players;
              this.callbacks.onLobbyUpdate?.(msg.players);
            } else {
              this.callbacks.onMessage?.(msg);
            }
          });

          conn.on('close', () => {
            this.callbacks.onError?.('Die Verbindung zum Host wurde getrennt.');
            this.callbacks.onStatusChange?.('Verbindung getrennt.');
          });

          conn.on('error', (err) => {
            this.callbacks.onError?.(`Verbindungsfehler: ${err}`);
            reject(err);
          });
        });

        this.peer.on('error', (err: any) => {
          if (err.type === 'peer-unavailable') {
            this.callbacks.onError?.(`Raum "${cleanCode}" nicht gefunden. Prüfe den Code.`);
          } else {
            this.callbacks.onError?.(`Netzwerkfehler: ${err.message || err.type}`);
          }
          reject(err);
        });
      } catch (e: any) {
        this.callbacks.onError?.(`Fehler beim Beitreten: ${e.message}`);
        reject(e);
      }
    });
  }

  /**
   * Host handles incoming connection from a guest
   */
  private handleIncomingConnection(conn: DataConnection) {
    if (!this.isHost) return;

    if (this.lobbyPlayers.length >= 4) {
      conn.close();
      return;
    }

    conn.on('open', () => {
      this.connections.set(conn.peer, conn);
    });

    conn.on('data', (data: any) => {
      const msg = data as MultiplayerMessageType;
      if (msg.type === 'JOIN_REQUEST') {
        const newPlayerId = this.lobbyPlayers.length;
        const newPlayer: LobbyPlayer = {
          id: newPlayerId,
          name: msg.name,
          grade: msg.grade,
          peerId: conn.peer,
          isHost: false,
          color: INITIAL_COLORS[newPlayerId] || '#9333EA',
        };
        this.lobbyPlayers.push(newPlayer);

        // Notify newly joined guest
        conn.send({
          type: 'JOIN_ACCEPTED',
          players: this.lobbyPlayers,
          assignedId: newPlayerId,
        } as MultiplayerMessageType);

        // Broadcast updated lobby to all connected peers
        this.broadcast({
          type: 'LOBBY_UPDATE',
          players: this.lobbyPlayers,
        });

        this.callbacks.onLobbyUpdate?.(this.lobbyPlayers);
        this.callbacks.onStatusChange?.(`Spieler "${msg.name}" ist dem Raum beigetreten.`);
      } else {
        // Forward message to app and other peers
        this.callbacks.onMessage?.(msg);
        this.broadcast(msg, conn.peer);
      }
    });

    conn.on('close', () => {
      this.connections.delete(conn.peer);
      const departing = this.lobbyPlayers.find((p) => p.peerId === conn.peer);
      if (departing) {
        this.lobbyPlayers = this.lobbyPlayers.filter((p) => p.peerId !== conn.peer);
        // Re-index remaining guests
        this.lobbyPlayers.forEach((p, idx) => {
          p.id = idx;
          p.color = INITIAL_COLORS[idx] || '#9333EA';
        });
        this.broadcast({
          type: 'LOBBY_UPDATE',
          players: this.lobbyPlayers,
        });
        this.callbacks.onLobbyUpdate?.(this.lobbyPlayers);
        this.callbacks.onStatusChange?.(`Spieler "${departing.name}" hat den Raum verlassen.`);
      }
    });
  }

  /**
   * Send message to all peers in the game
   */
  public broadcast(message: MultiplayerMessageType, excludePeerId?: string) {
    if (this.isHost) {
      this.connections.forEach((conn, peerId) => {
        if (peerId !== excludePeerId && conn.open) {
          try {
            conn.send(message);
          } catch (e) {
            console.error('Error broadcasting to peer:', peerId, e);
          }
        }
      });
    } else if (this.hostConnection && this.hostConnection.open) {
      try {
        this.hostConnection.send(message);
      } catch (e) {
        console.error('Error sending to host:', e);
      }
    }
  }

  /**
   * Disconnect and clean up
   */
  public disconnect() {
    this.connections.forEach((conn) => {
      try {
        conn.close();
      } catch (e) {}
    });
    this.connections.clear();

    if (this.hostConnection) {
      try {
        this.hostConnection.close();
      } catch (e) {}
      this.hostConnection = null;
    }

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {}
      this.peer = null;
    }

    this.isHost = false;
    this.myPlayerId = 0;
    this.roomCode = '';
    this.lobbyPlayers = [];
  }
}
