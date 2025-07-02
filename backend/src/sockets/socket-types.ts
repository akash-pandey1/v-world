import { Session } from '../session'

export const JoinRealm = {
    realmId: '',
    shareId: '',
}

export const Disconnect = {}

export const MovePlayer = {
    x: 0,
    y: 0,
}

export const Teleport = {
    x: 0,
    y: 0,
    roomIndex: 0,
}

export const ChangedSkin = ''

export const NewMessage = ''

export type OnEventCallback = (args: { session: Session, data?: any }) => void