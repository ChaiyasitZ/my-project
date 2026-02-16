import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  name: {
    type: String,
    required: true,
    maxlength: 255
  },
  picture: {
    type: String,
    default: null
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'system'],
      default: 'system'
    },
    language: {
      type: String,
      enum: ['en', 'th'],
      default: 'en'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Index for faster queries
userSchema.index({ email: 1 });
userSchema.index({ lastLogin: -1 });

// Static method to find or create user from Google profile
userSchema.statics.findOrCreateFromGoogle = async function(profile) {
  try {
    let user = await this.findOne({ googleId: profile.id });
    
    if (user) {
      // Update existing user's info
      user.name = profile.displayName || profile.name?.givenName || 'User';
      user.picture = profile.photos?.[0]?.value || null;
      user.lastLogin = new Date();
      await user.save();
    } else {
      // Create new user
      user = await this.create({
        googleId: profile.id,
        email: profile.emails?.[0]?.value || `${profile.id}@google.com`,
        name: profile.displayName || profile.name?.givenName || 'User',
        picture: profile.photos?.[0]?.value || null,
        lastLogin: new Date()
      });
    }
    
    return user;
  } catch (error) {
    throw error;
  }
};

// Instance method to get safe user data (without sensitive info)
userSchema.methods.toSafeObject = function() {
  return {
    id: this._id,
    googleId: this.googleId,
    email: this.email,
    name: this.name,
    picture: this.picture,
    role: this.role,
    isActive: this.isActive,
    preferences: this.preferences,
    lastLogin: this.lastLogin,
    createdAt: this.createdAt
  };
};

export default mongoose.model('User', userSchema);
