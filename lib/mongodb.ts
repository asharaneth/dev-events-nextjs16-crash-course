import "server-only";
import mongoose from "mongoose";

interface MongooseCache {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
}

declare global {
    var mongooseCache: MongooseCache | undefined;
}

// Keep the cache on globalThis so it survives Next.js development hot reloads.
const cached = globalThis.mongooseCache ?? (globalThis.mongooseCache = {
    conn: null,
    promise: null,
});

export async function connectToDatabase(): Promise<typeof mongoose> {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        throw new Error("Please define MONGODB_URI in your environment variables.");
    }

    if (cached.conn) {
        return cached.conn;
    }

    // Reuse the in-flight connection promise to prevent duplicate connections.
    if (!cached.promise) {
        cached.promise = mongoose.connect(uri).then((connection) => connection);
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        throw error;
    }

    return cached.conn;
}
