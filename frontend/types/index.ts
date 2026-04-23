export interface Stop {
    _id?: string;
    name: string;
    placeId?: string;
    lat: number;
    lng: number;
    category: 'hotel' | 'restaurant' | 'landmark' | 'activity' | 'transport' | 'shopping' | 'museum' | 'park' | 'nightlife' | 'medical' | 'grocery' | 'finance' | 'other';
    notes?: string;
    order: number;
    duration?: number;
    address?: string;
    rating?: number;
    photo?: string;
    arrivalTime?: string;
    cost?: number;
    expenseId?: string;
}

export interface Day {
    _id?: string;
    date: string;
    dayNumber: number;
    stops: Stop[];
}

export interface Trip {
    _id: string;
    name: string;
    destination: string;
    startDate: string;
    endDate: string;
    coverImage?: string;
    owner: string;
    collaborators: string[];
    days: Day[];
    isPublished: boolean;
    publishedAt?: string;
    status: 'planning' | 'active' | 'completed';
    createdAt: string;
    updatedAt: string;
}

export interface User {
    _id: string;
    firebaseUid: string;
    email: string;
    displayName: string;
    avatarUrl?: string;
    followers: string[];
    following: string[];
    followRequests: string[];
    pendingFollowing: string[];
    publishedTrips: string[];
}

export interface Expense {
    _id: string;
    trip: string;
    user: string;
    description: string;
    amount: number;
    currency: string;
    category: 'accommodation' | 'food' | 'transport' | 'activities' | 'other';
    date: string;
    dayNumber?: number;
    splitAmong: string[];
}

export interface BudgetSummary {
    expenses: Expense[];
    summary: {
        total: number;
        byCategory: Record<string, number>;
        byDay: Record<string, number>;
        participantCount: number;
        perPerson: number;
    };
}

export interface FeedPost {
    _id: string;
    trip: string;
    author: string;
    authorName: string;
    authorAvatar?: string;
    tripName: string;
    destination: string;
    coverImage?: string;
    startDate: string;
    endDate: string;
    duration: number;
    participantCount: number;
    totalBudget: number;
    stopCount: number;
    likes: string[];
    likeCount: number;
    createdAt: string;
}

export interface POI {
    id: string;
    placeId?: string;
    name: string;
    lat: number;
    lng: number;
    category: string;
    address?: string;
    rating?: number;
    totalRatings?: number;
    photo?: string;
    phone?: string;
    website?: string;
    openingHours?: string | string[];
    priceLevel?: number;
    source: 'overpass' | 'google_places';
}

export interface RouteData {
    geometry: {
        type: string;
        coordinates: number[][];
    };
    distance: number;
    duration: number;
    steps: {
        instruction: string;
        distance: number;
        duration: number;
    }[];
}
