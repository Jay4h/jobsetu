// Home.tsx
import { Link } from "react-router-dom";
import Reveal from "../components/Reveal";
import SearchBar from "../components/SearchBar";

/* ---------- small helpers ---------- */
function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

function FeatureCard({ title, desc, delay = 0 }: { title: string; desc: string; delay?: number }) {
  return (
    <Reveal delay={delay}>
      <div className="card card-hover p-4">
        <div className="font-medium">{title}</div>
        <p className="text-sm text-gray-600 mt-1">{desc}</p>
      </div>
    </Reveal>
  );
}

export default function Home() {



  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-6 py-8 lg:py-12">
      {/* HERO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* left */}
        <div className="lg:col-span-7">
          <Reveal>
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="badge">AI Resume Score</span>
              <span className="badge">Skill-based Match</span>
              <span className="badge">SignalR Chat</span>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="gradient-title text-4xl lg:text-5xl font-extrabold leading-tight tracking-tight">
              Hire faster. Apply smarter. <br className="hidden sm:block" />
              JobSetu — AI-Powered Job Portal
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mt-4 text-gray-600 max-w-xl">
              Skill-matched jobs, resume scoring, real-time chat, and recruiter tools — all in a fast, modern interface.
            </p>
          </Reveal>

          {/* Search bar */}
        <SearchBar
        onSubmit={(q) => {
          // navigate with keyword only
          window.location.href = `/jobs?q=${encodeURIComponent(q)}`;
        }}
      />

          {/* quick actions */}
          <Reveal delay={320}>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link to="/jobs" className="btn btn-ghost">Browse Jobs</Link>
              <Link to="/companies" className="btn btn-soft">Explore Companies</Link>
            </div>
          </Reveal>

          {/* stats */}
          <Reveal delay={400}>
            <div className="mt-8 grid grid-cols-3 gap-4 max-w-md">
              <Stat value="1,200+" label="Active Companies" />
              <Stat value="6,800+" label="Open Jobs" />
              <Stat value="98%" label="Resume Parsing Accuracy" />
            </div>
          </Reveal>
        </div>

        {/* right feature column */}
        <div className="lg:col-span-5 space-y-4">
          <FeatureCard title="Smart Matching" desc="Instantly see roles that fit your skills and experience." />
          <FeatureCard delay={80} title="Resume Insights" desc="Score, suggestions, and tailored bullets for every job." />
          <FeatureCard delay={160} title="Real-time Chat" desc="Seeker ↔ Recruiter messaging with read receipts." />
          <FeatureCard delay={240} title="Recruiter Tools" desc="Bulk upload, analytics, and powerful applicant filters." />
        </div>
      </div>

      {/* HOW IT WORKS */}
      <Reveal>
        <section className="mt-14 grid md:grid-cols-3 gap-4">
          <div className="card card-hover p-5">
            <div className="text-sm font-semibold">1 · Create Profile</div>
            <p className="text-sm text-gray-600 mt-1">Import resume, auto-parse skills, and set visibility.</p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm font-semibold">2 · Get Matched</div>
            <p className="text-sm text-gray-600 mt-1">We score your fit and surface tailored openings.</p>
          </div>
          <div className="card card-hover p-5">
            <div className="text-sm font-semibold">3 · Apply & Chat</div>
            <p className="text-sm text-gray-600 mt-1">Apply in one click and chat with recruiters in real-time.</p>
          </div>
        </section>
      </Reveal>

      {/* FEATURED JOBS */}
      <Reveal>
        <section className="mt-14">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Featured Jobs</h2>
            <Link to="/jobs" className="text-sm text-gray-700 hover:text-gray-900">See all</Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {title:"React Frontend Engineer", company:"Acme Corp", location:"Ahmedabad · Hybrid", tags:["React","TypeScript","Tailwind"], salary:"₹8–14 LPA"},
              {title:"C# .NET API Developer", company:"Krypton", location:"Surat · On-site", tags:["C#",".NET","SQL"], salary:"₹10–16 LPA"},
              {title:"Data Analyst", company:"Futura", location:"Remote", tags:["Python","SQL","PowerBI"], salary:"₹7–12 LPA"},
            ].map((j, i)=>(
              <div key={i} className="card card-hover p-4 group">
                <div className="font-medium">{j.title}</div>
                <div className="text-sm text-gray-600 mt-0.5">{j.company} · {j.location}</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {j.tags.map(t=> <span key={t} className="badge">{t}</span>)}
                </div>
                <div className="mt-3 text-sm text-gray-700">Salary: {j.salary}</div>
                <div className="mt-3 flex gap-2">
                  <button className="btn btn-primary">Apply</button>
                  <button className="btn btn-ghost">Save</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      {/* TESTIMONIALS */}
      <Reveal>
        <section className="mt-14 grid md:grid-cols-3 gap-4">
          {[
            {q:"“Got interviews within 48 hours. Matching felt spot on.”", a:"— Priya, Frontend Dev"},
            {q:"“Parsing nailed my skills and the fit score explained why.”", a:"— Nikhil, Data Analyst"},
            {q:"“Chat with recruiters saved days of back-and-forth.”", a:"— Aisha, .NET Engineer"},
          ].map((t,i)=>(
            <div key={i} className="card card-hover p-4 float-soft">
              <p className="text-sm">{t.q}</p>
              <p className="text-xs text-gray-500 mt-2">{t.a}</p>
            </div>
          ))}
        </section>
      </Reveal>

      {/* CTA */}
      <Reveal>
        <section className="mt-16 card p-6 text-center">
          <h3 className="text-lg font-semibold">Ready to explore?</h3>
          <p className="text-sm text-gray-600 mt-1">Find roles that match your skills right now.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link to="/jobs" className="btn btn-primary">Browse Jobs</Link>
            <Link to="/companies" className="btn btn-ghost">Explore Companies</Link>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
