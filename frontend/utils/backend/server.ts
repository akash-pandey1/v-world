// Placeholder server object for PlayApp compatibility
export const server = {
    async connect(realmId: string, uid: string, shareId: string, access_token: string) {
        // Simulate a successful connection
        return { success: true, errorMessage: '' };
    },
    async getPlayersInRoom(roomIndex: number) {
        // Return only the local player for now
        return { data: { players: [] }, error: null };
    }
}; 