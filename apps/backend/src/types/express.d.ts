declare global {
  namespace Express {
    interface Request {
      auth?: {
        userId: string;
        email: string;
        isSuperAdmin: boolean;
      };
    }
  }
}

export {};
