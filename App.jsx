import React, { useState, useEffect, useRef } from 'react';
import {
  Heart, Shield, Sparkles, BookOpen, MessageSquare, Flame, Trophy,
  ChevronRight, ArrowLeft, Send, Volume2, VolumeX, Mic, MicOff,
  User, Settings, Bell, Phone, AlertTriangle, Check, RefreshCw,
  Plus, Trash2, Edit2, LogOut, Lock, Award, Play, Compass, Key,
  Calendar, Layers, ShieldAlert, Sparkle, ExternalLink
} from 'lucide-react';
import { supabase, authEnabled } from './supabase';

/* ==========================================================================
   THEME & CONSTANTS
   ========================================================================== */
const T = {
  bgTop: '#ece7f4',
  bgMid: '#eef0f7',
  bgBot: '#fdefe7',
  card: '#ffffff',
  ink: '#28262f',
  sub: '#726e7c',
  line: '#e9e3f0',
  green: '#37a065',
  greenDk: '#2c7d50',
  teal: '#2f9e93',
  tealDk: '#227d74',
  blue: '#3f6faf',
  blueDk: '#2f5a8c',
  red: '#dc2626',
  shadowSoft: '0 4px 20px rgba(0,0,0,0.05)',
  shadowLift: '0 8px 30px rgba(0,0,0,0.08)'
};

const OWNER_EMAIL = 'sloanefox.official@gmail.com';

const CHARS = [
  {
    slug: 'rex',
    name: 'Rex',
    role: 'Welcomer & Orientation Host',
    img: 'https://rh-pi-green.vercel.app/merch/vixen.png',
    tint: '#3f6faf',
    voiceId: 'en-AU-Chirp3-HD-Algenib',
    pitch: 1.0,
    rate: 1.0,
    desc: 'Warm, steady host who helps you settle in and explore your options.'
  },
  {
    slug: 'juan',
    name: 'Juan',
    role: 'Lived-Experience Main Mate',
    img: 'https://rh-pi-green.vercel.app/merch/signature.png',
    tint: '#37a065',
    voiceId: 'en-AU-Chirp3-HD-Umbriel',
    pitch: 0.95,
    rate: 1.0,
    desc: 'Real, practical peer support grounded in lived experience.'
  },
  {
    slug: 'carlos',
    name: 'Carlos',
    role: 'Registered Psychologist & Clinical Guide',
    img: 'https://rh-pi-green.vercel.app/merch/vertical.png',
    tint: '#2f9e93',
    voiceId: 'en-AU-Chirp3-HD-Puck',
    pitch: 1.0,
    rate: 0.95,
    desc: 'Evidence-based tools, structured reflection, and psychoeducation.'
  },
  {
    slug: 'mick',
    name: 'Mick',
    role: 'Practical Life & Housing Support',
    img: 'https://rh-pi-green.vercel.app/merch/hoodie.png',
    tint: '#726e7c',
    voiceId: 'en-AU-Chirp3-HD-Enceladus',
    pitch: 0.9,
    rate: 1.0,
    desc: 'Grounded guidance for daily logistics, housing stability, and routines.'
  },
  {
    slug: 'lila',
    name: 'Lila',
    role: 'Family & Relationships Guide',
    img: 'https://rh-pi-green.vercel.app/merch/pants.png',
    tint: '#9e2f6f',
    voiceId: 'en-AU-Chirp3-HD-Leda',
    pitch: 1.05,
    rate: 1.0,
    desc: 'Compassionate support for navigating family, boundaries, and connections.'
  }
];

const GAMES = [
  { id: 'sudoku', title: 'Sudoku', file: 'sudoku.html', tag: 'Puzzle', tint: T.blue, iconColor: T.blueDk },
  { id: 'wordsearch', title: 'Word Search', file: 'wordsearch.html', tag: 'Puzzle', tint: T.teal, iconColor: T.tealDk },
  { id: 'crossword', title: 'Mini Crossword', file: 'crossword.html', tag: 'Puzzle', tint: T.green, iconColor: T.greenDk },
  { id: 'neojack', title: 'Neo Jack', file: 'neojack.html', tag: 'Arcade', tint: '#8b5cf6', iconColor: '#6d28d9' },
  { id: 'sloanefox', title: 'Sloane Fox', file: 'sloanefox.html', tag: 'Arcade', tint: '#f59e0b', iconColor: '#d97706' }
];

/* ==========================================================================
   UI HELPER COMPONENTS
   ========================================================================== */
function BackBtn({ onBack }) {
  return (
    <button
      onClick={onBack}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        borderRadius: '9999px',
        backgroundColor: T.green,
        color: '#fff',
        border: 'none',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: T.shadowSoft,
        transition: 'transform 0.1s ease'
      }}
    >
      <ArrowLeft size={16} />
      <span>Previous Page</span>
    </button>
  );
}

// Red Logout Button matching the Previous Page pill style
function LogoutBtn({ onLogout }) {
  return (
    <button
      onClick={onLogout}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        padding: '10px 20px',
        borderRadius: '9999px',
        backgroundColor: T.red,
        color: '#ffffff',
        border: 'none',
        fontWeight: 600,
        fontSize: '14px',
        cursor: 'pointer',
        boxShadow: '0 2px 8px rgba(220,38,38,0.25)',
        transition: 'transform 0.1s ease'
      }}
    >
      <LogOut size={16} color="#ffffff" />
      <span>Logout</span>
    </button>
  );
}

function Card({ children, style = {}, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: T.card,
        borderRadius: '16px',
        padding: '20px',
        boxShadow: T.shadowSoft,
        border: `1px solid ${T.line}`,
        cursor: onClick ? 'pointer' : 'default',
        ...style
      }}
    >
      {children}
    </div>
  );
}

/* ==========================================================================
   MAIN APP COMPONENT
   ========================================================================== */
export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState('welcome');
  const [activeChar, setActiveChar] = useState(CHARS[0]);
  const [chatMessages, setChatMessages] = useState([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [activeGame, setActiveGame] = useState(null);
  const [gameScores, setGameScores] = useState({});

  const histRef = useRef(['welcome']);

  // Handle navigation
  const go = (nextScreen, charObj = null) => {
    if (charObj) setActiveChar(charObj);
    histRef.current.push(nextScreen);
    setScreen(nextScreen);
    window.scrollTo(0, 0);
  };

  const back = () => {
    if (histRef.current.length > 1) {
      histRef.current.pop();
      const prev = histRef.current[histRef.current.length - 1];
      setScreen(prev);
      window.scrollTo(0, 0);
    } else {
      setScreen('hub');
    }
  };

  // Auth Initialization
  useEffect(() => {
    if (!authEnabled) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid) => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
      if (data) setProfile(data);
    } catch (err) {
      console.log('Profile fetch note:', err);
    }
  };

  const handleSignOut = async () => {
    if (authEnabled) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setScreen('welcome');
    histRef.current = ['welcome'];
  };

  // Listen for iframe scores via postMessage
  useEffect(() => {
    const handleMessage = (e) => {
      if (e.data?.type === 'rh-score') {
        const { game, value } = e.data;
        setGameScores(prev => ({ ...prev, [game]: value }));
        
        if (user && authEnabled) {
          supabase.from('game_scores').upsert({
            user_id: user.id,
            game: game,
            best: value,
            updated_at: new Date()
          });
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [user]);

  /* ==========================================================================
     SCREEN RENDERERS
     ========================================================================== */
  const renderWelcome = () => (
    <div style={{ textAlign: 'center', paddingTop: '40px' }}>
      <h1 style={{ fontSize: '32px', color: T.ink, fontWeight: 700, marginBottom: '8px' }}>
        The Resilience Hub
      </h1>
      <p style={{ color: T.sub, fontSize: '16px', marginBottom: '32px' }}>
        You never have to walk it alone.
      </p>
      
      <Card style={{ marginBottom: '24px', textAlign: 'left' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 600, color: T.ink, marginBottom: '12px' }}>
          Welcome to Your Support Space
        </h2>
        <p style={{ color: T.sub, lineHeight: '1.6', marginBottom: '16px' }}>
          Explore self-guided plans, talk with tailored AI companions, access practical toolkits, and play ad-free wellness games.
        </p>
        <button
          onClick={() => go('hub')}
          style={{
            width: '100%',
            padding: '14px',
            backgroundColor: T.green,
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontWeight: 600,
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Enter The Hub
        </button>
      </Card>
    </div>
  );

  const renderHub = () => (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: T.ink }}>The Hub</h1>
          <p style={{ color: T.sub, fontSize: '14px' }}>Welcome back{profile?.preferred_name ? `, ${profile.preferred_name}` : ''}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        <Card onClick={() => go('guides')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MessageSquare color={T.green} size={28} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>Your Guides</h3>
              <p style={{ fontSize: '13px', color: T.sub }}>Chat with Juan, Carlos, Rex & more</p>
            </div>
          </div>
        </Card>

        <Card onClick={() => go('games')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Trophy color={T.blue} size={28} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>Games & Puzzles</h3>
              <p style={{ fontSize: '13px', color: T.sub }}>Ad-free relaxation & brain games</p>
            </div>
          </div>
        </Card>

        <Card onClick={() => go('toolkit')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BookOpen color={T.teal} size={28} />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>Self-Help Toolkit</h3>
              <p style={{ fontSize: '13px', color: T.sub }}>Practical strategies & guides</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );

  const renderGuides = () => (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <BackBtn onBack={back} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: T.ink, marginBottom: '16px' }}>
        Your Guides
      </h1>
      <div style={{ display: 'grid', gap: '16px' }}>
        {CHARS.map(char => (
          <Card key={char.slug} onClick={() => go('chat', char)}>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <img
                src={char.img}
                alt={char.name}
                style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>{char.name}</h3>
                <p style={{ fontSize: '12px', color: char.tint, fontWeight: 600 }}>{char.role}</p>
                <p style={{ fontSize: '13px', color: T.sub, marginTop: '4px' }}>{char.desc}</p>
              </div>
              <ChevronRight color={T.sub} />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  const renderChat = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 160px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <BackBtn onBack={back} />
        <img src={activeChar.img} alt={activeChar.name} style={{ width: '40px', height: '40px', borderRadius: '50%' }} />
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>{activeChar.name}</h2>
          <span style={{ fontSize: '12px', color: activeChar.tint }}>{activeChar.role}</span>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', backgroundColor: T.card, borderRadius: '16px', marginBottom: '12px' }}>
        {chatMessages.length === 0 ? (
          <p style={{ color: T.sub, textAlign: 'center', marginTop: '40px' }}>
            Say hello to {activeChar.name} to start chatting.
          </p>
        ) : (
          chatMessages.map((msg, idx) => (
            <div
              key={idx}
              style={{
                display: 'flex',
                justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: '12px'
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '12px 16px',
                  borderRadius: '16px',
                  backgroundColor: msg.sender === 'user' ? T.green : T.bgMid,
                  color: msg.sender === 'user' ? '#fff' : T.ink,
                  fontSize: '14px',
                  lineHeight: '1.5'
                }}
              >
                {msg.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ display: 'flex', gap: '8px' }}>
        <input
          type="text"
          value={inputMsg}
          onChange={(e) => setInputMsg(e.target.value)}
          placeholder={`Message ${activeChar.name}...`}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '9999px',
            border: `1px solid ${T.line}`,
            outline: 'none',
            fontSize: '14px'
          }}
          onKeyDown={(e) => e.key === 'Enter' && setInputMsg('')}
        />
        <button
          onClick={() => setInputMsg('')}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            backgroundColor: T.green,
            color: '#fff',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <Send size={18} />
        </button>
      </div>
    </div>
  );

  const renderGames = () => (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <BackBtn onBack={back} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: T.ink, marginBottom: '16px' }}>
        Games & Puzzles
      </h1>

      {activeGame ? (
        <div>
          <button
            onClick={() => setActiveGame(null)}
            style={{
              marginBottom: '12px',
              padding: '8px 16px',
              backgroundColor: T.sub,
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Close Game
          </button>
          <iframe
            src={`/${activeGame.file}`}
            title={activeGame.title}
            style={{
              width: '100%',
              height: '600px',
              border: 'none',
              borderRadius: '16px',
              backgroundColor: '#000'
            }}
          />
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
          {GAMES.map(g => (
            <Card key={g.id} onClick={() => setActiveGame(g)}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: g.iconColor,
                  letterSpacing: '0.5px'
                }}
              >
                {g.tag}
              </span>
              <h3 style={{ fontSize: '20px', fontWeight: 600, color: T.ink, marginTop: '4px' }}>
                {g.title}
              </h3>
              {gameScores[g.id] && (
                <p style={{ fontSize: '13px', color: T.sub, marginTop: '8px' }}>
                  Best: {gameScores[g.id]}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderToolkit = () => (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <BackBtn onBack={back} />
      </div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: T.ink, marginBottom: '16px' }}>
        Self-Help Toolkit
      </h1>
      <Card style={{ marginBottom: '12px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>Grounding Exercises</h3>
        <p style={{ fontSize: '14px', color: T.sub, marginTop: '4px' }}>
          Simple techniques to manage acute stress and anxiety in the moment.
        </p>
      </Card>
      <Card>
        <h3 style={{ fontSize: '18px', fontWeight: 600, color: T.ink }}>Sleep & Routine</h3>
        <p style={{ fontSize: '14px', color: T.sub, marginTop: '4px' }}>
          Practical steps to improve sleep quality and rebuild daily momentum.
        </p>
      </Card>
    </div>
  );

  /* ==========================================================================
     MAIN LAYOUT RENDER
     ========================================================================== */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: `linear-gradient(180deg, ${T.bgTop} 0%, ${T.bgMid} 50%, ${T.bgBot} 100%)`,
        color: T.ink,
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        padding: '20px 16px 120px 16px',
        maxWidth: '600px',
        margin: '0 auto',
        position: 'relative'
      }}
    >
      {/* Dynamic Screen Content */}
      {screen === 'welcome' && renderWelcome()}
      {screen === 'hub' && renderHub()}
      {screen === 'guides' && renderGuides()}
      {screen === 'chat' && renderChat()}
      {screen === 'games' && renderGames()}
      {screen === 'toolkit' && renderToolkit()}

      {/* FOOTER & LOGOUT SECTION */}
      <footer style={{ marginTop: '40px', textAlign: 'center', paddingBottom: '20px' }}>
        <p style={{ fontSize: '12px', color: T.sub, marginBottom: '16px', lineHeight: '1.4' }}>
          The Resilience Hub is a self-guided support tool and not a replacement for professional or emergency care.
        </p>

        {/* Red Logout Button located cleanly between disclaimer and bottom crisis bar */}
        {user && (
          <div style={{ marginTop: '12px', marginBottom: '8px' }}>
            <LogoutBtn onLogout={handleSignOut} />
          </div>
        )}
      </footer>

      {/* CRISIS BAR (FIXED BOTTOM) */}
      <div
        className="crisis-bar-wrapper"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#1f2937',
          color: '#ffffff',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 1000,
          boxShadow: '0 -2px 10px rgba(0,0,0,0.15)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldAlert color="#ef4444" size={20} />
          <span style={{ fontSize: '13px', fontWeight: 600 }}>Need help now?</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', fontSize: '13px' }}>
          <a href="tel:000" style={{ color: '#f87171', fontWeight: 700, textDecoration: 'none' }}>000</a>
          <span style={{ color: '#6b7280' }}>|</span>
          <a href="tel:131114" style={{ color: '#60a5fa', fontWeight: 600, textDecoration: 'none' }}>Lifeline 13 11 14</a>
        </div>
      </div>
    </div>
  );
}
