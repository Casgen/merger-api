import {Session} from "inspector";

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