import { Router } from 'express'
import { GetPlayersInRoom, GetServerName, IsOwnerOfServer, UserIsInGuild, GetChannelName, GetPlayerCounts } from './route-types'
import { sessionManager, Player } from '../session'
import { User } from '../Users'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { Request as ExpressRequest } from 'express'
import fs from 'fs'
import path from 'path'
import { Realm } from '../Realm'
require('dotenv').config()
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

interface AuthRequest extends ExpressRequest {
  user?: any;
}

// In-memory realms store for demo
const realms: any[] = [
  // Example realm
  {
    id: '1',
    owner_id: 'demo-user-id',
    name: 'Demo Realm',
    map_data: { spawnpoint: { roomIndex: 0, x: 0, y: 0 }, rooms: [] },
    share_id: 'share-1',
    only_owner: false,
  },
]

function sanitizeRealm(realm: any): any {
  if (realm && realm.map_data && Array.isArray(realm.map_data.rooms)) {
    realm.map_data.rooms = realm.map_data.rooms.map((room: any) => ({
      ...room,
      tilemap: room.tilemap || {}
    }));
  }
  return realm;
}

// Ensure the room_tilemaps directory exists
const tilemapDir = path.join(__dirname, '../room_tilemaps');
if (!fs.existsSync(tilemapDir)) {
  fs.mkdirSync(tilemapDir);
}

export default function routes(): Router {
    const router = Router()

    router.get('/getPlayersInRoom', async (req, res) => {
        const access_token = req.headers.authorization?.split(' ')[1];

        if (!access_token) {
            return res.status(401).json({ message: 'No access token provided' });
        }

        const params = req.query;
        const roomIndex = typeof params.roomIndex === 'string' ? parseInt(params.roomIndex, 10) : undefined;
        if (roomIndex === undefined || isNaN(roomIndex)) {
            return res.status(400).json({ message: 'Invalid parameters' })
        }

        // You need a realmId to get the session. For now, use a placeholder or get from params if available.
        const realmId = typeof params.realmId === 'string' ? params.realmId : '';
        const session = sessionManager.getSession(realmId);
        let players: Player[] = [];
        if (session) {
            players = session.getPlayersInRoom(roomIndex);
        }
        return res.json({ players });
    })

    router.get('/getPlayerCounts', async (req, res) => {
        const access_token = req.headers.authorization?.split(' ')[1];

        if (!access_token) {
            return res.status(401).json({ message: 'No access token provided' });
        }

        let params = req.query;
        let realmIds: string[] = [];
        if (typeof params.realmIds === 'string') {
            realmIds = params.realmIds.split(',');
        } else if (Array.isArray(params.realmIds)) {
            realmIds = params.realmIds as string[];
        }
        if (!realmIds.length) {
            return res.status(400).json({ message: 'Invalid parameters' })
        }
        if (realmIds.length > 100) {
            return res.status(400).json({ message: 'Too many server IDs' })
        }

        const playerCounts: number[] = []
        for (const realmId of realmIds) {
            const session = sessionManager.getSession(realmId)
            if (session) {
                const playerCount = session.getPlayerCount()

                playerCounts.push(playerCount)
            } else {
                playerCounts.push(0)
            }
        }

        return res.json({ playerCounts })
    })

    // Signup route
    router.post('/auth/signup', async (req, res) => {
        const { email, name, password } = req.body;
        if (!email || !name || !password) {
            return res.status(400).json({ message: 'Missing fields' });
        }
        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: 'Email already in use' });
        }
        const hashed = await bcrypt.hash(password, 10);
        const user = new User({ email, name, password: hashed });
        await user.save();
        return res.status(201).json({ message: 'User created' });
    });

    // Login route
    router.post('/auth/login', async (req, res) => {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Missing fields' });
        }
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ message: 'Invalid credentials' });
        }
        if (!JWT_SECRET) {
            return res.status(500).json({ message: 'Server configuration error' });
        }
        const token = jwt.sign({ id: user._id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
        return res.json({ token });
    });

    // Get all realms for the authenticated user
    router.get('/realms', async (req, res) => {
      const userId = (req as AuthRequest).user.id
      const userRealms = await Realm.find({ owner_id: userId })
      res.json({ realms: userRealms.map(sanitizeRealm) })
    })

    // Get a specific realm by ID for the authenticated user
    router.get('/realms/:id', async (req, res) => {
      const userId = (req as AuthRequest).user.id
      const realm = await Realm.findOne({ _id: req.params.id, owner_id: userId })
      if (!realm) return res.status(404).json({ error: 'Realm not found' })
      // Load each room's tilemap from file
      const map_data = JSON.parse(JSON.stringify(realm.map_data));
      for (let i = 0; i < map_data.rooms.length; i++) {
        const room = map_data.rooms[i];
        if (room.tilemapFile) {
          const filePath = path.join(tilemapDir, room.tilemapFile);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            room.tilemap = JSON.parse(raw);
          } catch (e) {
            room.tilemap = {};
          }
        }
      }
      res.json({ realm: { ...realm.toObject(), map_data } })
    })

    // Create a new realm
    router.post('/realms', async (req, res) => {
      const userId = (req as AuthRequest).user.id;
      const { name, map_data: incomingMapData } = req.body;
      if (!name) return res.status(400).json({ message: 'Name is required' });

      // Use provided map_data or load default
      let map_data = incomingMapData;
      if (!map_data) {
        const defaultMapPath = path.join(__dirname, '../../frontend/utils/defaultmap.json');
        let defaultMap = { rooms: [{ name: 'Home', tilemap: {} }], spawnpoint: { roomIndex: 0, x: 0, y: 0 } };
        try {
          const raw = fs.readFileSync(defaultMapPath, 'utf-8');
          defaultMap = JSON.parse(raw);
        } catch (e) {}
        map_data = {
          rooms: defaultMap.rooms,
          spawnpoint: defaultMap.spawnpoint || { roomIndex: 0, x: 0, y: 0 }
        };
      }
      // Save each room's tilemap to a file and store filename
      const share_id = `share-${Date.now()}-${Math.floor(Math.random()*10000)}`;
      const roomsWithFiles = map_data.rooms.map((room: any, idx: number) => {
        const tilemapFile = `room_${share_id}_${idx}.json`;
        const filePath = path.join(tilemapDir, tilemapFile);
        fs.writeFileSync(filePath, JSON.stringify(room.tilemap || {}));
        return { ...room, tilemapFile, tilemap: undefined };
      });
      const newRealm = new Realm({
        owner_id: userId,
        name,
        map_data: { ...map_data, rooms: roomsWithFiles },
        share_id,
        only_owner: false,
      });
      await newRealm.save();
      res.status(201).json({ realm: newRealm });
    });

    // Join a realm by share ID (public join)
    router.get('/realms/join/:shareId', async (req, res) => {
      const realm = await Realm.findOne({ share_id: req.params.shareId });
      if (!realm) return res.status(404).json({ error: 'Realm not found' });
      // Load each room's tilemap from file (same as /realms/:id)
      const map_data = JSON.parse(JSON.stringify(realm.map_data));
      for (let i = 0; i < map_data.rooms.length; i++) {
        const room = map_data.rooms[i];
        if (room.tilemapFile) {
          const filePath = path.join(tilemapDir, room.tilemapFile);
          try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            room.tilemap = JSON.parse(raw);
          } catch (e) {
            room.tilemap = {};
          }
        }
      }
      res.json({ realm: { ...realm.toObject(), map_data } });
    });

    // Delete a realm by ID for the authenticated user
    router.delete('/realms/:id', async (req, res) => {
      const userId = (req as AuthRequest).user.id;
      const { id } = req.params;
      const deleted = await Realm.findOneAndDelete({ _id: id, owner_id: userId });
      if (!deleted) return res.status(404).json({ error: 'Realm not found or not owned by user' });
      res.json({ success: true });
    });

    return router
}