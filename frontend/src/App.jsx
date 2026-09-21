import Navbar from './components/Navbar'
import Hero from './components/Hero'
import EnrollSection from './components/EnrollSection'
import IdentifySection from './components/IdentifySection'

/**
 * App — root layout.
 * Assembles: Navbar → Hero → Enroll section → Identify section.
 * No routing needed for this single-page application.
 */
export default function App() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        {/* Section divider */}
        <div
          style={{
            maxWidth: '880px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <div className="section-divider" />
        </div>
        <EnrollSection />
        <div
          style={{
            maxWidth: '880px',
            margin: '0 auto',
            padding: '0 24px',
          }}
        >
          <div className="section-divider" />
        </div>
        <IdentifySection />
      </main>
    </>
  )
}
