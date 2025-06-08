/**
 * User Identification Service
 * Provides persistent user identification across browser sessions
 * Uses multiple strategies: localStorage, sessionStorage, and browser fingerprinting
 */

interface UserIdentifier {
  userId: string
  created: number
  method: 'stored' | 'fingerprint' | 'generated'
}

export class UserIdentificationService {
  private static readonly USER_ID_KEY = 'chat_user_id'
  private static readonly USER_DATA_KEY = 'chat_user_data'
  
  /**
   * Check if we're running in the browser
   */
  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }
  
  /**
   * Get or create a persistent user ID
   */
  static getUserId(): string {
    if (!this.isBrowser()) {
      // During SSR, return a temporary ID
      return 'ssr-temp-id'
    }
    
    // Try to get existing user ID from localStorage
    const storedUserId = localStorage.getItem(this.USER_ID_KEY)
    if (storedUserId) {
      return storedUserId
    }

    // Try to get from sessionStorage as fallback
    const sessionUserId = sessionStorage.getItem(this.USER_ID_KEY)
    if (sessionUserId) {
      // Move it to localStorage for persistence
      localStorage.setItem(this.USER_ID_KEY, sessionUserId)
      return sessionUserId
    }

    // Generate new user ID
    const newUserId = this.generateUserId()
    
    // Store in both localStorage and sessionStorage
    localStorage.setItem(this.USER_ID_KEY, newUserId)
    sessionStorage.setItem(this.USER_ID_KEY, newUserId)
    
    // Store user metadata
    const userData: UserIdentifier = {
      userId: newUserId,
      created: Date.now(),
      method: 'generated'
    }
    localStorage.setItem(this.USER_DATA_KEY, JSON.stringify(userData))
    
    return newUserId
  }

  /**
   * Generate a unique user ID
   */
  private static generateUserId(): string {
    // Create a unique ID based on timestamp and random values
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 15)
    const fingerprint = this.getBrowserFingerprint()
    
    return `user_${timestamp}_${random}_${fingerprint}`
  }
  /**
   * Get basic browser fingerprint for user identification
   */
  private static getBrowserFingerprint(): string {
    if (!this.isBrowser()) {
      return 'ssr'
    }
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (ctx) {
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillText('Browser fingerprint', 2, 2)
    }
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL()
    ].join('|')
    
    // Simple hash function
    let hash = 0
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(36).substring(0, 8)
  }
  /**
   * Get user metadata
   */
  static getUserData(): UserIdentifier | null {
    if (!this.isBrowser()) {
      return null
    }
    
    const userData = localStorage.getItem(this.USER_DATA_KEY)
    if (userData) {
      try {
        return JSON.parse(userData)
      } catch {
        return null
      }
    }
    return null
  }
  /**
   * Clear user identification (for testing or logout)
   */
  static clearUserId(): void {
    if (!this.isBrowser()) {
      return
    }
    
    localStorage.removeItem(this.USER_ID_KEY)
    localStorage.removeItem(this.USER_DATA_KEY)
    sessionStorage.removeItem(this.USER_ID_KEY)
  }

  /**
   * Check if user is returning (has existing data)
   */
  static isReturningUser(): boolean {
    if (!this.isBrowser()) {
      return false
    }
    
    return !!localStorage.getItem(this.USER_ID_KEY)
  }

  /**
   * Get user session age in days
   */
  static getUserAge(): number {
    const userData = this.getUserData()
    if (userData) {
      const ageMs = Date.now() - userData.created
      return Math.floor(ageMs / (1000 * 60 * 60 * 24))
    }
    return 0
  }
}
