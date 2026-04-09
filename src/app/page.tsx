import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Shield, Bell, Users, CheckCircle, Clock } from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex-shrink-0 flex items-center">
              <span className="text-2xl font-bold text-blue-600">Toothpoint</span>
            </div>
            <nav className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
                Features
              </Link>
              <Link href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">
                How It Works
              </Link>
              <Link href="/login" className="btn-primary">
                Sign In
              </Link>
              <Link href="/signup" className="btn-outline">
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-20 pb-32 lg:pt-32 lg:pb-40 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-gray-900 tracking-tight">
                Book Dental Appointments <span className="text-blue-600">Effortlessly</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto">
                Toothpoint makes it easy for patients to find available slots and book appointments,
                while giving dentists full control over their schedule.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup" className="btn-primary text-lg px-8 py-3 w-full sm:w-auto">
                  Start Booking Free
                </Link>
                <Link href="#how-it-works" className="btn-outline text-lg px-8 py-3 w-full sm:w-auto">
                  Learn More
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                Everything You Need for Seamless Booking
              </h2>
              <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
                Built for modern dental practices and their patients
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Calendar className="h-8 w-8" />}
                title="Smart Scheduling"
                description="Dentists set recurring availability; slots are generated automatically. No double-bookings, ever."
              />
              <FeatureCard
                icon={<Clock className="h-8 w-8" />}
                title="Real-time Calendar"
                description="Live calendar view with color-coded appointments. Instant updates when bookings change."
              />
              <FeatureCard
                icon={<Bell className="h-8 w-8" />}
                title="Push Notifications"
                description="Get reminded 24 hours and 1 hour before appointments. Works offline with PWA support."
              />
              <FeatureCard
                icon={<Shield className="h-8 w-8" />}
                title="Secure & Private"
                description="Row-level security ensures patients only see their data. Dentists manage their own schedules."
              />
              <FeatureCard
                icon={<Users className="h-8 w-8" />}
                title="Role-based Access"
                description="Separate interfaces for patients and dentists. Each gets the tools they need."
              />
              <FeatureCard
                icon={<CheckCircle className="h-8 w-8" />}
                title="Approval Workflow"
                description="Patients request, dentists approve. Full audit trail with status tracking."
              />
            </div>
          </div>
        </section>

        <section id="how-it-works" className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900">
                How It Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <StepCard
                number="1"
                title="Dentist Sets Availability"
                description="Define weekly working hours, block dates, and generate time slots with a few clicks."
              />
              <StepCard
                number="2"
                title="Patient Books Appointment"
                description="Browse dentists, filter by availability, pick a slot, and send a booking request."
              />
              <StepCard
                number="3"
                title="Dentist Approves & Patient Confirmed"
                description="Dentist reviews requests, approves or rejects. Patient gets instant notification and reminders."
              />
            </div>
          </div>
        </section>

        <section className="py-20 bg-blue-600">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white">
              Ready to Simplify Your Dental Booking?
            </h2>
            <p className="mt-4 text-lg text-blue-100 max-w-2xl mx-auto">
              Join thousands of patients and dentists using Toothpoint. Free to start, no credit card required.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup" className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-3 font-medium rounded-lg transition-colors w-full sm:w-auto">
                Create Free Account
              </Link>
              <Link href="/login" className="border-2 border-white text-white hover:bg-blue-700 text-lg px-8 py-3 font-medium rounded-lg transition-colors w-full sm:w-auto">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-gray-200 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-blue-600">Toothpoint</span>
              <span className="text-sm text-gray-500">© 2026</span>
            </div>
            <nav className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/login" className="hover:text-gray-900">Sign In</Link>
              <Link href="/signup" className="hover:text-gray-900">Sign Up</Link>
              <span>Privacy</span>
              <span>Terms</span>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="card p-6 hover:shadow-md transition-shadow">
      <div className="text-blue-600 mb-4">{icon}</div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function StepCard({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}