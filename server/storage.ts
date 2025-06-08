import { 
  friends, 
  buzzes, 
  userProfiles,
  userSessions,
  twoFactorCodes,
  type Friend, 
  type InsertFriend, 
  type Buzz, 
  type InsertBuzz,
  type UserProfile,
  type InsertUserProfile,
  type UpdateUserProfile,
  type UserSession,
  type InsertUserSession,
  type InsertTwoFactorCode,
  type TwoFactorCode
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gt, lt } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<Friend | undefined>;
  getUserByUsername(username: string): Promise<Friend | undefined>;
  createUser(user: any): Promise<any>;
  getAllFriends(): Promise<Friend[]>;
  getFriend(id: number): Promise<Friend | undefined>;
  createFriend(friend: InsertFriend): Promise<Friend>;
  createBuzz(buzz: InsertBuzz): Promise<Buzz>;
  getBuzzHistory(): Promise<Buzz[]>;
  
  // User profile operations
  getUserProfile(id: string): Promise<UserProfile | undefined>;
  getUserProfileByPhone(phoneNumber: string): Promise<UserProfile | undefined>;
  getUserProfileByEmail(email: string): Promise<UserProfile | undefined>;
  getUserProfileByUsername(username: string): Promise<UserProfile | undefined>;
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  updateUserProfile(id: string, updates: UpdateUserProfile): Promise<UserProfile>;
  
  // 2FA operations
  createTwoFactorCode(code: InsertTwoFactorCode): Promise<TwoFactorCode>;
  getTwoFactorCode(phoneNumber: string, code: string, purpose: string): Promise<TwoFactorCode | undefined>;
  markTwoFactorCodeAsUsed(id: number): Promise<void>;
  cleanupExpiredCodes(): Promise<void>;
  
  // Session operations
  createUserSession(session: InsertUserSession): Promise<UserSession>;
  getUserSession(token: string): Promise<UserSession | undefined>;
  getUserSessions(userId: string): Promise<UserSession[]>;
  updateSessionLastUsed(sessionId: string): Promise<void>;
  invalidateUserSession(sessionId: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<Friend | undefined> {
    const [user] = await db.select().from(friends).where(eq(friends.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<Friend | undefined> {
    const [user] = await db.select().from(friends).where(eq(friends.name, username));
    return user || undefined;
  }

  async createUser(insertUser: any): Promise<any> {
    const [user] = await db
      .insert(friends)
      .values(insertUser)
      .returning();
    return user;
  }

  async getAllFriends(): Promise<Friend[]> {
    return await db.select().from(friends);
  }

  async getFriend(id: number): Promise<Friend | undefined> {
    const [friend] = await db.select().from(friends).where(eq(friends.id, id));
    return friend || undefined;
  }

  async createFriend(insertFriend: InsertFriend): Promise<Friend> {
    const [friend] = await db
      .insert(friends)
      .values(insertFriend)
      .returning();
    return friend;
  }

  async createBuzz(insertBuzz: InsertBuzz): Promise<Buzz> {
    const [buzz] = await db
      .insert(buzzes)
      .values(insertBuzz)
      .returning();
    return buzz;
  }

  async getBuzzHistory(): Promise<Buzz[]> {
    return await db.select().from(buzzes);
  }

  // User profile operations
  async getUserProfile(id: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.id, id));
    return profile || undefined;
  }

  async getUserProfileByPhone(phoneNumber: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.phoneNumber, phoneNumber));
    return profile || undefined;
  }

  async getUserProfileByEmail(email: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.email, email));
    return profile || undefined;
  }

  async getUserProfileByUsername(username: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.username, username));
    return profile || undefined;
  }

  async createUserProfile(insertProfile: InsertUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .insert(userProfiles)
      .values(insertProfile)
      .returning();
    return profile;
  }

  async updateUserProfile(id: string, updates: UpdateUserProfile): Promise<UserProfile> {
    const [profile] = await db
      .update(userProfiles)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(userProfiles.id, id))
      .returning();
    return profile;
  }

  // 2FA operations
  async createTwoFactorCode(insertCode: InsertTwoFactorCode): Promise<TwoFactorCode> {
    const [code] = await db
      .insert(twoFactorCodes)
      .values(insertCode)
      .returning();
    return code;
  }

  async getTwoFactorCode(phoneNumber: string, code: string, purpose: string): Promise<TwoFactorCode | undefined> {
    const [twoFactorCode] = await db
      .select()
      .from(twoFactorCodes)
      .where(
        and(
          eq(twoFactorCodes.phoneNumber, phoneNumber),
          eq(twoFactorCodes.code, code),
          eq(twoFactorCodes.purpose, purpose),
          eq(twoFactorCodes.isUsed, false),
          gt(twoFactorCodes.expiresAt, new Date())
        )
      );
    return twoFactorCode || undefined;
  }

  async markTwoFactorCodeAsUsed(id: number): Promise<void> {
    await db
      .update(twoFactorCodes)
      .set({ isUsed: true })
      .where(eq(twoFactorCodes.id, id));
  }

  async cleanupExpiredCodes(): Promise<void> {
    await db
      .delete(twoFactorCodes)
      .where(lt(twoFactorCodes.expiresAt, new Date()));
  }

  // Session operations
  async createUserSession(insertSession: InsertUserSession): Promise<UserSession> {
    const [session] = await db
      .insert(userSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getUserSession(token: string): Promise<UserSession | undefined> {
    const [session] = await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.token, token),
        eq(userSessions.isActive, true),
        gt(userSessions.expiresAt, new Date())
      ));
    return session;
  }

  async getUserSessions(userId: string): Promise<UserSession[]> {
    return await db
      .select()
      .from(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.isActive, true)
      ))
      .orderBy(userSessions.lastUsed);
  }

  async updateSessionLastUsed(sessionId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ lastUsed: new Date() })
      .where(eq(userSessions.id, sessionId));
  }

  async invalidateUserSession(sessionId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.id, sessionId));
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.userId, userId));
  }

  async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    await db
      .update(userSessions)
      .set({ isActive: false })
      .where(lt(userSessions.expiresAt, now));
  }
}

export const storage = new DatabaseStorage();
