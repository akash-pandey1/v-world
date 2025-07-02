export const GetPlayersInRoom = {
    roomIndex: (val: string) => parseInt(val, 10),
}

export const IsOwnerOfServer = {
    serverId: (val: string) => val,
}

export const GetServerName = {
    serverId: (val: string) => val,
}

export const GetChannelName = {
    serverId: (val: string) => val,
    channelId: (val: string) => val,
    userId: (val: string) => val,
}

export const UserIsInGuild = {
    guildId: (val: string) => val,
}

export const GetPlayerCounts = {
    realmIds: (s: string) => s.split(','),
}