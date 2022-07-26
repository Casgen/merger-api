declare global {
    namespace Express {
        interface Request {
            session: session.Session & Partial<session.SessionData>;
            sessionID: string;
            sessionStore: SessionStore;
        }
    }
}

export {}