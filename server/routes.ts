import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import crypto from "crypto";
import bcrypt from "bcrypt";

// Session validation middleware
async function validateSession(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No valid session token provided' });
    }

    const token = authHeader.substring(7);
    const session = await storage.getUserSession(token);
    
    if (!session) {
      return res.status(401).json({ message: 'Invalid or expired session' });
    }

    // Update session last used time
    await storage.updateSessionLastUsed(session.id);

    // Add user and session info to request
    (req as any).userId = session.userId;
    (req as any).sessionId = session.id;
    
    next();
  } catch (error) {
    console.error('Session validation error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Email/Password authentication routes
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { username, email, password } = req.body;
      
      if (!username || !email || !password) {
        return res.status(400).json({ message: "Username, email, and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserProfileByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "An account with this email already exists" });
      }

      // Create active user profile (no verification needed)
      const userId = crypto.randomUUID();
      const hashedPassword = await bcrypt.hash(password, 12);
      
      await storage.createUserProfile({
        id: userId,
        email,
        name: username,
        username: username, // Save username to the profile
        password: hashedPassword,
        verifiedEmail: true, // Account is immediately active
        authMethod: 'email'
      });

      // Send welcome email
      try {
        const { sendWelcomeEmail } = await import('./email');
        await sendWelcomeEmail(email, username);
      } catch (emailError) {
        console.error('Welcome email sending failed:', emailError);
        // Continue registration even if email fails
      }

      res.json({
        success: true,
        message: "Registration successful! Welcome to FrootRoute.",
        userId
      });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await storage.getUserProfileByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password || '');
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      // Create session
      const sessionToken = crypto.randomUUID();
      const session = await storage.createUserSession({
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        deviceInfo: req.headers['user-agent'] || 'Unknown',
        ipAddress: req.ip || 'Unknown',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
      });

      res.json({
        success: true,
        message: "Login successful",
        token: sessionToken,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          locationPermissionAsked: user.locationPermissionAsked,
          locationPermissionGranted: user.locationPermissionGranted
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/verify-email", async (req, res) => {
    try {
      const { email, code } = req.body;
      
      if (!email || !code) {
        return res.status(400).json({ message: "Email and verification code are required" });
      }

      // Verify the code
      const verificationRecord = await storage.getTwoFactorCode(email, code, 'email_verification');
      if (!verificationRecord) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      // Mark code as used
      await storage.markTwoFactorCodeAsUsed(verificationRecord.id);

      // Update user as verified
      const user = await storage.getUserProfile(verificationRecord.userId!);
      if (!user) {
        return res.status(400).json({ message: "User not found" });
      }

      await storage.updateUserProfile(user.id, { verifiedEmail: true });

      // Create session
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await storage.createUserSession({
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        deviceInfo: req.get('User-Agent') || null,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        expiresAt
      });

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Find user by email
      const user = await storage.getUserProfileByEmail(email);
      if (!user) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password || '');
      if (!isValidPassword) {
        return res.status(400).json({ message: "Invalid email or password" });
      }

      // Check if email is verified
      if (!user.verifiedEmail) {
        return res.status(400).json({ 
          message: "Please verify your email before logging in",
          requiresVerification: true 
        });
      }

      // Create session
      const sessionToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

      await storage.createUserSession({
        id: crypto.randomUUID(),
        userId: user.id,
        token: sessionToken,
        deviceInfo: req.get('User-Agent') || null,
        ipAddress: req.ip || req.connection.remoteAddress || null,
        expiresAt
      });

      res.json({
        success: true,
        token: sessionToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Send confirmation email after successful account creation
  app.post("/api/auth/send-confirmation", validateSession, async (req, res) => {
    try {
      const { email, username } = req.body;
      
      if (!email || !username) {
        return res.status(400).json({ message: "Email and username are required" });
      }

      // Send welcome confirmation email
      try {
        const { sendWelcomeEmail } = await import('./email');
        await sendWelcomeEmail(email, username);
      } catch (emailError) {
        console.error('Welcome email sending failed:', emailError);
        // Don't fail the request if welcome email fails
      }

      res.json({
        success: true,
        message: "Confirmation email sent successfully"
      });
    } catch (error) {
      console.error("Confirmation email error:", error);
      res.status(500).json({ message: "Failed to send confirmation email" });
    }
  });

  // Get all friends
  app.get("/api/friends", async (req, res) => {
    try {
      const friends = await storage.getAllFriends();
      res.json(friends);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friends" });
    }
  });

  // Get specific friend
  app.get("/api/friends/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const friend = await storage.getFriend(id);
      
      if (!friend) {
        return res.status(404).json({ error: "Friend not found" });
      }
      
      res.json(friend);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch friend" });
    }
  });

  // Mock Snapchat connection endpoint
  app.post("/api/connect-snapchat", async (req, res) => {
    try {
      // In a real app, this would integrate with Snapchat API
      res.json({ 
        success: true, 
        message: "Snapchat integration would be implemented here",
        connected: false
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect with Snapchat" });
    }
  });

  // Buzz a friend endpoint
  app.post("/api/buzz/:friendId", async (req, res) => {
    try {
      const friendId = parseInt(req.params.friendId);
      const friend = await storage.getFriend(friendId);
      
      if (!friend) {
        return res.status(404).json({ error: "Friend not found" });
      }
      
      // Create buzz record in database
      // Assuming current user ID is 1 for demo purposes
      const buzz = await storage.createBuzz({
        fromFriendId: 1,
        toFriendId: friendId,
        status: "sent"
      });
      
      // In a real app, this would:
      // 1. Send location data to the friend's bracelet
      // 2. Request the friend's current location
      // 3. Handle the bracelet communication protocol
      
      res.json({ 
        success: true, 
        message: `Buzz sent to ${friend.name}! Location exchange initiated.`,
        friend: friend,
        buzz: buzz,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to send buzz" });
    }
  });

  // Get buzz history endpoint
  app.get("/api/buzzes", async (req, res) => {
    try {
      const buzzes = await storage.getBuzzHistory();
      res.json(buzzes);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch buzz history" });
    }
  });

  // Phone number authentication routes
  app.post("/api/auth/send-verification", async (req, res) => {
    try {
      const { phoneNumber, purpose } = req.body;
      
      if (!phoneNumber || !purpose) {
        return res.status(400).json({ message: "Phone number and purpose are required" });
      }

      // Generate 6-digit verification code
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Set expiration time (10 minutes from now)
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      
      // Store verification code in database
      await storage.createTwoFactorCode({
        phoneNumber,
        code,
        purpose,
        expiresAt,
        isUsed: false
      });

      // In a real implementation, you would send SMS here
      // For now, we'll log the code for testing
      console.log(`Verification code for ${phoneNumber}: ${code}`);
      
      res.json({ 
        message: "Verification code sent successfully",
        // Only return code in development for testing
        ...(process.env.NODE_ENV === 'development' && { code })
      });
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post("/api/auth/verify-phone", async (req, res) => {
    try {
      const { phoneNumber, code, fullName, purpose } = req.body;
      
      if (!phoneNumber || !code || !purpose) {
        return res.status(400).json({ message: "Phone number, code, and purpose are required" });
      }

      // Find valid verification code
      const twoFactorCode = await storage.getTwoFactorCode(phoneNumber, code, purpose);
      
      if (!twoFactorCode) {
        return res.status(400).json({ message: "Invalid or expired verification code" });
      }

      // Mark code as used
      await storage.markTwoFactorCodeAsUsed(twoFactorCode.id);

      if (purpose === 'signup') {
        // Check if user already exists
        const existingUser = await storage.getUserProfileByPhone(phoneNumber);
        if (existingUser) {
          return res.status(400).json({ message: "User with this phone number already exists" });
        }

        // Create new user profile
        const userProfile = await storage.createUserProfile({
          id: `phone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          phoneNumber,
          name: fullName,
          authMethod: 'phone',
          verifiedPhone: true,
          twoFactorEnabled: true
        });

        res.json({ 
          message: "Phone verified and account created successfully",
          user: userProfile
        });
      } else if (purpose === 'login') {
        // Find existing user
        const user = await storage.getUserProfileByPhone(phoneNumber);
        if (!user) {
          return res.status(404).json({ message: "No account found with this phone number" });
        }

        // Create a new session for the user
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const sessionToken = `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
        const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

        const session = await storage.createUserSession({
          id: sessionId,
          userId: user.id,
          token: sessionToken,
          deviceInfo: req.headers['user-agent'] || 'Unknown',
          ipAddress: req.ip || req.connection.remoteAddress || 'Unknown',
          expiresAt
        });

        // Update last active time
        await storage.updateUserProfile(user.id, {});

        res.json({ 
          message: "Login successful",
          token: sessionToken,
          sessionId: session.id,
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            authMethod: user.authMethod,
            locationPermissionAsked: user.locationPermissionAsked,
            locationPermissionGranted: user.locationPermissionGranted
          }
        });
      } else {
        res.status(400).json({ message: "Invalid purpose" });
      }
    } catch (error) {
      console.error("Error verifying phone:", error);
      res.status(500).json({ message: "Failed to verify phone number" });
    }
  });

  // User logout - invalidate session
  app.post('/api/auth/logout', validateSession, async (req: any, res) => {
    try {
      await storage.invalidateUserSession(req.sessionId);
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Error during logout:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get current user info (protected route)
  app.get('/api/auth/me', validateSession, async (req: any, res) => {
    try {
      const user = await storage.getUserProfile(req.userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.phoneNumber,
        authMethod: user.authMethod,
        username: user.username,
        bio: user.bio,
        location: user.location,
        timezone: user.timezone,
        isLocationShared: user.isLocationShared,
        locationPermissionAsked: user.locationPermissionAsked,
        locationPermissionGranted: user.locationPermissionGranted,
        locationSharingDuration: user.locationSharingDuration,
        locationSharingExpiresAt: user.locationSharingExpiresAt
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Get user sessions (protected route)
  app.get('/api/auth/sessions', validateSession, async (req: any, res) => {
    try {
      const sessions = await storage.getUserSessions(req.userId);
      res.json(sessions.map(session => ({
        id: session.id,
        deviceInfo: session.deviceInfo,
        ipAddress: session.ipAddress,
        lastUsed: session.lastUsed,
        createdAt: session.createdAt,
        isCurrent: session.id === req.sessionId
      })));
    } catch (error) {
      console.error('Error fetching sessions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invalidate specific session (protected route)
  app.delete('/api/auth/sessions/:sessionId', validateSession, async (req: any, res) => {
    try {
      const { sessionId } = req.params;
      await storage.invalidateUserSession(sessionId);
      res.json({ message: 'Session invalidated successfully' });
    } catch (error) {
      console.error('Error invalidating session:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Invalidate all sessions except current (protected route)
  app.post('/api/auth/logout-all', validateSession, async (req: any, res) => {
    try {
      // Get all user sessions and invalidate all except current
      const sessions = await storage.getUserSessions(req.userId);
      for (const session of sessions) {
        if (session.id !== req.sessionId) {
          await storage.invalidateUserSession(session.id);
        }
      }
      res.json({ message: 'All other sessions logged out successfully' });
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Update user profile (protected route)
  app.put('/api/user/profile', validateSession, async (req: any, res) => {
    try {
      const { username, name, bio, location, timezone } = req.body;
      const userId = req.userId;

      // Check if username is being changed and if it's already taken
      if (username) {
        const existingUser = await storage.getUserProfileByUsername(username);
        if (existingUser && existingUser.id !== userId) {
          return res.status(400).json({ message: "Username is already taken" });
        }
      }

      // Update the user profile
      const updatedProfile = await storage.updateUserProfile(userId, {
        ...(username && { username }),
        ...(name && { name }),
        ...(bio !== undefined && { bio }),
        ...(location && { location }),
        ...(timezone && { timezone }),
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: "Profile updated successfully",
        profile: {
          id: updatedProfile.id,
          username: updatedProfile.username,
          name: updatedProfile.name,
          email: updatedProfile.email,
          bio: updatedProfile.bio,
          location: updatedProfile.location,
          timezone: updatedProfile.timezone,
          updatedAt: updatedProfile.updatedAt
        }
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });

  // Get user profile (protected route)
  app.get('/api/user/profile', validateSession, async (req: any, res) => {
    try {
      const userId = req.userId;
      const profile = await storage.getUserProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }

      res.json({
        id: profile.id,
        username: profile.username,
        name: profile.name,
        email: profile.email,
        phoneNumber: profile.phoneNumber,
        bio: profile.bio,
        location: profile.location,
        timezone: profile.timezone,
        isLocationShared: profile.isLocationShared,
        createdAt: profile.createdAt,
        updatedAt: profile.updatedAt
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      res.status(500).json({ message: 'Failed to fetch profile' });
    }
  });

  // Check username availability
  app.post('/api/user/check-username', validateSession, async (req: any, res) => {
    try {
      const { username } = req.body;
      const userId = req.userId;

      if (!username) {
        return res.status(400).json({ message: "Username is required" });
      }

      // Check if username exists and belongs to a different user
      const existingUser = await storage.getUserProfileByUsername(username);
      const isAvailable = !existingUser || existingUser.id === userId;

      res.json({
        available: isAvailable,
        message: isAvailable ? "Username is available" : "Username is already taken"
      });
    } catch (error) {
      console.error('Error checking username:', error);
      res.status(500).json({ message: 'Failed to check username availability' });
    }
  });

  // Update location permission preferences
  app.post('/api/user/location-permission', validateSession, async (req: any, res) => {
    try {
      const { granted, duration } = req.body;
      const userId = req.userId;

      if (typeof granted !== 'boolean') {
        return res.status(400).json({ message: "Permission granted status is required" });
      }

      let expiresAt = null;
      if (granted && duration && duration !== 'until_turned_off') {
        const now = new Date();
        switch (duration) {
          case '1hour':
            expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
            break;
          case '8hours':
            expiresAt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
            break;
          case '24hours':
            expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            break;
        }
      }

      // Update user's location permission preferences
      await storage.updateUserProfile(userId, {
        locationPermissionAsked: true,
        locationPermissionGranted: granted,
        isLocationShared: granted,
        locationSharingDuration: granted ? duration : null,
        locationSharingExpiresAt: expiresAt
      });

      res.json({
        success: true,
        message: "Location permission preferences saved",
        locationPermissionGranted: granted,
        locationSharingDuration: duration,
        locationSharingExpiresAt: expiresAt
      });
    } catch (error) {
      console.error('Error saving location permission:', error);
      res.status(500).json({ message: 'Failed to save location permission' });
    }
  });

  // Cleanup expired 2FA codes and sessions (run periodically)
  setInterval(async () => {
    try {
      await storage.cleanupExpiredCodes();
      await storage.cleanupExpiredSessions();
    } catch (error) {
      console.error("Error cleaning up expired data:", error);
    }
  }, 60 * 60 * 1000); // Run every hour

  const httpServer = createServer(app);
  return httpServer;
}
