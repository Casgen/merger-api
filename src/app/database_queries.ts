
export const selectPlaylistByIdAndUser = (id: number, userId: number): string => {
   return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.name, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE playlists.id = ${id} AND users.id = ${userId}`;
}

export const insertPlaylist = (title = "New Playlist", userId: number, desc = ""): string =>  {
    return `INSERT INTO playlists (playlists.name,playlists.creator,playlists.desc) VALUES ('${title}',${userId},'${desc}');`
}

export const selectPlaylistsByUser = (userId: number): string => {
    return `SELECT playlists.id, playlists.creator, playlists.desc, playlists.name, users.username FROM playlists
           INNER JOIN users
           ON playlists.creator = users.id
           WHERE users.id = ${userId}`;
}
