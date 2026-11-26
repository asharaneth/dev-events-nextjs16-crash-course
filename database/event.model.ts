import "server-only";
import mongoose, { Schema } from "mongoose";

export interface EventDocument {
    title: string;
    slug: string;
    description: string;
    overview: string;
    image: string;
    venue: string;
    location: string;
    date: string;
    time: string;
    mode: string;
    audience: string;
    agenda: string[];
    organizer: string;
    tags: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

function createSlug(title: string): string {
    const slug = title
        .normalize("NFKD")
        .toLowerCase()
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");

    if (!slug) {
        throw new Error("Event title must contain characters that can be used in a slug.");
    }

    return slug;
}

function normalizeDate(value: string): string {
    const datePart = /^(\d{4}-\d{2}-\d{2})(?:$|T)/.exec(value)?.[1];
    if (datePart) {
        const parsedDate = new Date(`${datePart}T00:00:00.000Z`);
        if (parsedDate.toISOString().slice(0, 10) !== datePart) {
            throw new Error("Event date must be a valid date.");
        }
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error("Event date must be a valid date.");
    }

    // Store dates consistently as an ISO calendar date in UTC.
    return parsed.toISOString().slice(0, 10);
}

function normalizeTime(value: string): string {
    const parts = value.trim().split(/\s*(?:-|–|—|\bto\b)\s*/i);
    if (parts.length > 2 || parts.some((part) => part.length === 0)) {
        throw new Error("Event time must be a time or a time range.");
    }

    const formatTime = (time: string): string => {
        const match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i.exec(time);
        if (!match) {
            throw new Error("Event time must use HH:mm or h:mm AM/PM format.");
        }

        let hour = Number(match[1]);
        const minute = Number(match[2]);
        const second = Number(match[3] ?? 0);
        const meridiem = match[4]?.toUpperCase();

        if (minute > 59 || second > 59) {
            throw new Error("Event time must be a valid time.");
        }

        if (meridiem) {
            if (hour < 1 || hour > 12) {
                throw new Error("Event time must be a valid 12-hour time.");
            }
            hour = (hour % 12) + (meridiem === "PM" ? 12 : 0);
        } else if (hour > 23) {
            throw new Error("Event time must be a valid 24-hour time.");
        }

        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    };

    // Convert each endpoint to 24-hour HH:mm, preserving optional ranges.
    return parts.map(formatTime).join(" - ");
}

const nonEmptyString = {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
} as const;

const eventSchema = new Schema<EventDocument>(
    {
        title: nonEmptyString,
        slug: { type: String, required: true, trim: true },
        description: nonEmptyString,
        overview: nonEmptyString,
        image: nonEmptyString,
        venue: nonEmptyString,
        location: nonEmptyString,
        date: nonEmptyString,
        time: nonEmptyString,
        mode: nonEmptyString,
        audience: nonEmptyString,
        agenda: {
            type: [{ type: String, required: true, trim: true }],
            required: true,
            validate: {
                validator: (items: string[]) =>
                    items.length > 0 && items.every((item) => item.length > 0),
                message: "Agenda must contain at least one non-empty item.",
            },
        },
        organizer: nonEmptyString,
        tags: {
            type: [{ type: String, required: true, trim: true }],
            required: true,
            validate: {
                validator: (items: string[]) =>
                    items.length > 0 && items.every((item) => item.length > 0),
                message: "Tags must contain at least one non-empty item.",
            },
        },
    },
    { timestamps: true },
);

eventSchema.index({ slug: 1 }, { unique: true });

// Generate the slug before required-field validation, then keep it in sync on save.
eventSchema.pre("validate", function () {
    if (this.isModified("title")) {
        this.slug = createSlug(this.title);
    }
});

eventSchema.pre("save", function () {
    if (this.isModified("title")) {
        this.slug = createSlug(this.title);
    }

    const requiredFields = [
        "title",
        "description",
        "overview",
        "image",
        "venue",
        "location",
        "date",
        "time",
        "mode",
        "audience",
        "organizer",
    ] as const;

    // Keep required text and list values non-empty after trimming.
    for (const field of requiredFields) {
        if (!this[field].trim()) {
            throw new Error(`Event ${field} is required.`);
        }
    }
    if (!this.agenda.length || this.agenda.some((item) => !item.trim())) {
        throw new Error("Event agenda must contain non-empty items.");
    }
    if (!this.tags.length || this.tags.some((tag) => !tag.trim())) {
        throw new Error("Event tags must contain non-empty items.");
    }

    // Normalize date and time values before they are persisted.
    this.date = normalizeDate(this.date);
    this.time = normalizeTime(this.time);
});

export const Event = mongoose.models.Event
    ? mongoose.model<EventDocument>("Event")
    : mongoose.model<EventDocument>("Event", eventSchema);
