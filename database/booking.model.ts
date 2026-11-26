import "server-only";
import mongoose, { Schema, Types } from "mongoose";
import { Event } from "./event.model";

export interface BookingDocument {
    eventId: Types.ObjectId;
    email: string;
    createdAt?: Date;
    updatedAt?: Date;
}

const bookingSchema = new Schema<BookingDocument>(
    {
        eventId: {
            type: Schema.Types.ObjectId,
            ref: "Event",
            required: true,
        },
        email: {
            type: String,
            required: true,
            trim: true,
            lowercase: true,
            match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        },
    },
    { timestamps: true },
);

bookingSchema.index({ eventId: 1 });

// Reject bookings that reference an event which no longer exists.
bookingSchema.pre("save", async function () {
    const eventExists = await Event.exists({ _id: this.eventId });
    if (!eventExists) {
        throw new Error("Cannot create a booking for an event that does not exist.");
    }
});

export const Booking = mongoose.models.Booking
    ? mongoose.model<BookingDocument>("Booking")
    : mongoose.model<BookingDocument>("Booking", bookingSchema);
