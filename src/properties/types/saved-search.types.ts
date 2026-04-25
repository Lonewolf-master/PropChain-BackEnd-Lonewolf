/**
 * Prisma Type Definitions for Saved Search Models
 * These interfaces mirror the Prisma models defined in schema.prisma
 */

export interface SavedSearch {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  criteria: any; // Json
  isActive: boolean;
  alertEnabled: boolean;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchAlert {
  id: string;
  savedSearchId: string;
  propertyId: string;
  notified: boolean;
  notifiedAt: Date | null;
  createdAt: Date;
}

export interface SavedSearchWithRelations extends SavedSearch {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  alerts: SearchAlertItem[];
}

export interface SearchAlertItem {
  id: string;
  savedSearchId: string;
  propertyId: string;
  notified: boolean;
  notifiedAt: Date | null;
  createdAt: Date;
  property: {
    id: string;
    title: string;
    price: string;
    status: string;
  } | null;
}
