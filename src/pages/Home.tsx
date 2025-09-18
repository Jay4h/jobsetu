// Home.tsx
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal";
import { default as SearchBar } from "../components/SearchBar";
import Squares from "../components/Squares";

/* ---------- Enhanced component helpers ---------- */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center group">
      <div className="text-4xl font-bold text-gradient mb-2 animate-fade-in-scale">{value}</div>
      <div className="text-sm text-gray-500 group-hover:text-gray-700 transition-colors duration-300">{label}</div>
    </div>
  );
}

function FeatureCard({ title, desc, delay = 0, icon }: { title: string; desc: string; delay?: number; icon: React.ReactNode }) {
  return (
    <Reveal delay={delay}>
      <div className="card card-hover p-8 group relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 via-transparent to-accent-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
        <div className="relative z-10">
          <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
            {icon}
          </div>
          <h3 className="font-bold text-xl text-gray-900 mb-3 group-hover:text-primary-700 transition-colors duration-300">{title}</h3>
          <p className="text-gray-600 leading-relaxed">{desc}</p>
        </div>
      </div>
    </Reveal>
  );
}

function JobCard({ job, index }: { job: any; index: number }) {
  return (
    <Reveal delay={index * 80}>
      <div className="card card-hover p-6 group relative overflow-hidden">
        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-primary-500/10 to-accent-500/10 rounded-full -translate-y-6 translate-x-6 group-hover:scale-150 transition-transform duration-500"></div>
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-gray-900 group-hover:text-primary-700 transition-colors duration-300 mb-2">{job.title}</h3>
              <p className="text-sm text-gray-600">{job.company} • {job.location}</p>
            </div>
            {job.isUrgent && (
              <span className="badge badge-accent text-xs font-semibold">Urgent</span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 mb-5">
            {job.tags.map((tag: string) => (
              <span key={tag} className="badge badge-primary">{tag}</span>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <span className="font-bold text-lg text-gray-900">{job.salary}</span>
            <div className="flex gap-2">
              <button className="btn btn-primary btn-sm glow">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0h8" />
                </svg>
                Apply
              </button>
              <button className="btn btn-ghost btn-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function TestimonialCard({ testimonial, index }: { testimonial: any; index: number }) {
  return (
    <Reveal delay={index * 120}>
      <div className="card card-hover p-6 float-soft relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary-500 to-accent-500"></div>
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
            {testimonial.author[0]}
          </div>
          <div className="flex-1">
            <p className="text-gray-700 mb-4 leading-relaxed italic">"{testimonial.quote}"</p>
            <p className="text-sm text-gray-500 font-semibold">{testimonial.author}</p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export default function Home() {
  const featuredJobs = [
    { title: "React Frontend Engineer", company: "Acme Corp", location: "Ahmedabad • Hybrid", tags: ["React", "TypeScript", "Tailwind"], salary: "₹8–14 LPA", isUrgent: true },
    { title: "C# .NET API Developer", company: "Krypton", location: "Surat • On-site", tags: ["C#", ".NET", "SQL"], salary: "₹10–16 LPA", isUrgent: false },
    { title: "Data Analyst", company: "Futura", location: "Remote", tags: ["Python", "SQL", "PowerBI"], salary: "₹7–12 LPA", isUrgent: false },
  ];

  const testimonials = [
    { quote: "Got interviews within 48 hours. The AI matching felt incredibly accurate and saved me weeks of searching.", author: "Priya S., Frontend Developer" },
    { quote: "The resume parsing technology nailed my skills perfectly, and the fit score explained exactly why each role matched.", author: "Nikhil K., Data Analyst" },
    { quote: "Real-time chat with recruiters eliminated all the back-and-forth emails. I landed my dream job in 10 days.", author: "Aisha M., .NET Engineer" },
  ];

  return (
    <div className="hero-surface relative">
      {/* Animated Squares Background */}
      <div className="absolute inset-0 z-0">
        <Squares 
          speed={0.5} 
          squareSize={40}
          direction='diagonal'
          borderColor='rgba(59, 130, 246, 0.3)'
          hoverFillColor='rgba(59, 130, 246, 0.4)'
        />
      </div>
      
      <div className="max-w-7xl mx-auto px-4 lg:px-6 py-12 lg:py-16 relative z-10">
        {/* ENHANCED HERO SECTION */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-7">
            <Reveal>
              <div className="flex flex-wrap gap-3 mb-6">
                <span className="badge badge-primary">AI Resume Score</span>
                <span className="badge badge-success">Skill-based Match</span>
                <span className="badge badge-accent">Real-time Chat</span>
              </div>
            </Reveal>

            <Reveal delay={80}>
              <h1 className="gradient-title text-5xl lg:text-7xl font-extrabold leading-tight tracking-tight mb-8">
                Job Search Ends.<br />
                <span className="text-gradient animate-glow">New Role Begins!</span>
              </h1>
            </Reveal>

            <Reveal delay={160}>
              <p className="text-xl text-gray-600 max-w-2xl mb-10 leading-relaxed">
                Apply from anywhere today. Work globally. Connect with opportunities that match your skills
                through our AI-powered job portal designed for the modern workforce.
              </p>
            </Reveal>

            {/* Enhanced Search Bar */}
            <Reveal delay={240}>
              <div className="mb-8">
                <SearchBar
                  onSubmit={(q) => {
                    window.location.href = `/jobs?q=${encodeURIComponent(q)}`;
                  }}
                />
              </div>
            </Reveal>

            {/* Enhanced CTA Buttons */}
            <Reveal delay={320}>
              <div className="flex flex-wrap gap-4 mb-10">
                <Link to="/jobs" className="btn btn-primary btn-lg glow">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2-2v2m8 0V6a2 2 0 012 2v6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m-8 0h8" />
                  </svg>
                  Start Applying
                </Link>
                <Link to="/companies" className="btn btn-ghost btn-lg">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Explore Companies
                </Link>
              </div>
            </Reveal>

            {/* Enhanced Stats */}
            <Reveal delay={400}>
              <div className="grid grid-cols-3 gap-8 max-w-md">
                <Stat value="1,200+" label="Active Companies" />
                <Stat value="6,800+" label="Open Positions" />
                <Stat value="98%" label="Match Accuracy" />
              </div>
            </Reveal>
          </div>

          {/* Right Column - Feature Cards */}
          <div className="lg:col-span-5 space-y-6">
            <FeatureCard
              title="Smart Matching"
              desc="Our AI analyzes your skills, experience, and preferences to surface roles that truly fit your profile."
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
            />
            <FeatureCard
              delay={80}
              title="Resume Insights"
              desc="Get detailed scoring, personalized suggestions, and tailored content for every application."
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
            />
            <FeatureCard
              delay={160}
              title="Real-time Chat"
              desc="Connect instantly with recruiters through our integrated messaging system with read receipts."
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>}
            />
            <FeatureCard
              delay={240}
              title="Recruiter Tools"
              desc="Advanced analytics, bulk operations, and powerful candidate filtering for hiring teams."
              icon={<svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
            />
          </div>
        </div>

        {/* HOW IT WORKS - Enhanced Section */}
        <Reveal>
          <section className="mt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">How JobSetu Works</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">Get started in three simple steps and land your dream job faster than ever</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="card card-hover p-8 text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">1</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Create Your Profile</h3>
                <p className="text-gray-600 leading-relaxed">Upload your resume, let our AI parse your skills automatically, and set your job preferences with precision.</p>
              </div>
              <div className="card card-hover p-8 text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-warning-500 to-warning-400 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">2</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Get Smart Matches</h3>
                <p className="text-gray-600 leading-relaxed">Our AI scores your compatibility with every role and surfaces opportunities that align with your experience and goals.</p>
              </div>
              <div className="card card-hover p-8 text-center group">
                <div className="w-16 h-16 bg-gradient-to-br from-success-500 to-success-600 rounded-full flex items-center justify-center text-white text-2xl font-bold mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">3</div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">Apply & Connect</h3>
                <p className="text-gray-600 leading-relaxed">Apply with one click and engage in real-time conversations with recruiters to fast-track your hiring process.</p>
              </div>
            </div>
          </section>
        </Reveal>

        {/* FEATURED JOBS - Enhanced Section */}
        <Reveal>
          <section className="mt-20">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Opportunities</h2>
                <p className="text-gray-600">Handpicked roles from top companies actively hiring</p>
              </div>
              <Link to="/jobs" className="btn btn-ghost">
                <span>View All Jobs</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredJobs.map((job, index) => (
                <JobCard key={index} job={job} index={index} />
              ))}
            </div>
          </section>
        </Reveal>

        {/* TESTIMONIALS - Enhanced Section */}
        <Reveal>
          <section className="mt-20">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Success Stories</h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">Hear from professionals who found their dream jobs through JobSetu</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {testimonials.map((testimonial, index) => (
                <TestimonialCard key={index} testimonial={testimonial} index={index} />
              ))}
            </div>
          </section>
        </Reveal>

        {/* COMPANIES SECTION */}
        <Reveal>
          <section className="mt-20">
            <div className="text-center mb-12">
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-6">Trusted by Industry Leaders</p>
              <div className="flex flex-wrap items-center justify-center gap-8 lg:gap-12 opacity-60">
                {/* Company logos placeholder - you can replace with actual logos */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="w-28 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl shimmer flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                    <span className="text-xs text-gray-500 font-semibold">Company {i + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </Reveal>

        {/* FINAL CTA - Enhanced */}
        <Reveal>
          <section className="mt-20">
            <div className="card-premium p-12 text-center">
              <div className="max-w-3xl mx-auto">
                <h2 className="text-4xl font-bold text-gray-900 mb-4">Ready to Transform Your Career?</h2>
                <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                  Join thousands of professionals who've discovered their perfect role through JobSetu's intelligent matching system.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link to="/jobs" className="btn btn-primary btn-lg glow">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Browse Jobs Now
                  </Link>
                  <Link to="/companies" className="btn btn-ghost btn-lg">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Explore Companies
                  </Link>
                </div>
                <div className="mt-8 flex items-center justify-center gap-6 text-sm text-gray-500">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <span>Free to join</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <span>AI-powered matching</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-success-500 rounded-full"></div>
                    <span>Instant applications</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </Reveal>
      </div>
    </div>
  );
}
