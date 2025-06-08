import { NextRequest, NextResponse } from 'next/server'
import { prisma } from './prisma'

interface RateLimitOptions {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  keyGenerator?: (request: NextRequest) => string // Custom key generator
}

class RateLimiter {
  private options: RateLimitOptions

  constructor(options: RateLimitOptions) {
    this.options = options
  }

  async isAllowed(request: NextRequest): Promise<{ allowed: boolean; remainingRequests?: number; resetTime?: Date }> {
    const key = this.options.keyGenerator ? this.options.keyGenerator(request) : this.getDefaultKey(request)
    const now = new Date()
    const windowStart = new Date(now.getTime() - this.options.windowMs)

    try {
      // Clean up old rate limit records
      await prisma.rateLimit.deleteMany({
        where: {
          createdAt: {
            lt: windowStart
          }
        }
      })

      // Count current requests in the window
      const requestCount = await prisma.rateLimit.count({
        where: {
          key,
          createdAt: {
            gte: windowStart
          }
        }
      })

      if (requestCount >= this.options.maxRequests) {
        const resetTime = new Date(now.getTime() + this.options.windowMs)
        return {
          allowed: false,
          remainingRequests: 0,
          resetTime
        }
      }

      // Record this request
      await prisma.rateLimit.create({
        data: {
          key,
          createdAt: now
        }
      })

      return {
        allowed: true,
        remainingRequests: this.options.maxRequests - requestCount - 1,
        resetTime: new Date(now.getTime() + this.options.windowMs)
      }

    } catch (error) {
      console.error('Rate limit check failed:', error)
      // On error, allow the request to proceed
      return { allowed: true }
    }
  }

  private getDefaultKey(request: NextRequest): string {
    // Use IP address as default key
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'
    return `rate_limit:${ip}`
  }
}

// Pre-configured rate limiters
export const chatRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20 // 20 requests per minute
})

export const uploadRateLimit = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5 // 5 uploads per minute
})

export const authRateLimit = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10 // 10 auth attempts per 15 minutes
})

export async function rateLimitMiddleware(
  request: NextRequest,
  rateLimiter: RateLimiter
): Promise<NextResponse | null> {
  const result = await rateLimiter.isAllowed(request)
  
  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        resetTime: result.resetTime?.toISOString(),
        message: 'Too many requests. Please try again later.'
      },
      {
        status: 429,
        headers: {
          'Retry-After': Math.ceil((result.resetTime?.getTime() || Date.now() - Date.now()) / 1000).toString(),
          'X-RateLimit-Limit': rateLimiter['options'].maxRequests.toString(),
          'X-RateLimit-Remaining': (result.remainingRequests || 0).toString(),
          'X-RateLimit-Reset': result.resetTime?.toISOString() || ''
        }
      }
    )
  }

  return null // Allow request to proceed
}
