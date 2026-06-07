import { useState, useEffect } from 'react'

export const USERS = [
  { id: 'CTRL_001', name: 'Arjun Mehta',  upi: '9800000001@paytm', role: 'Controller', balance: 100000, avatar: 'A', isController: true },
  { id: 'MULE_001', name: 'Ravi Kumar',   upi: '9123456001@paytm', role: 'Mule 1',     balance: 10000,  avatar: 'R', isController: false },
  { id: 'MULE_002', name: 'Priya Singh',  upi: '9123456002@paytm', role: 'Mule 2',     balance: 10000,  avatar: 'P', isController: false },
  { id: 'MULE_003', name: 'Suresh Nair',  upi: '9123456003@paytm', role: 'Mule 3',     balance: 10000,  avatar: 'S', isController: false },
  { id: 'MULE_004', name: 'Deepa Rao',    upi: '9123456004@paytm', role: 'Mule 4',     balance: 10000,  avatar: 'D', isController: false },
  { id: 'MULE_005', name: 'Kiran Patel',  upi: '9123456005@paytm', role: 'Mule 5',     balance: 10000,  avatar: 'K', isController: false },
]

export default function Login({ onLogin }) {
  const [usersList, setUsersList] = useState(USERS)
  const [selected, setSelected] = useState(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/kyc/users')
      .then(res => res.json())
      .then(data => {
        if (data && data.users) {
          // Merge hardcoded users with fetched dynamic users
          const fetchedUpis = new Set(data.users.map(u => u.upi))
          const merged = [...USERS.filter(u => !fetchedUpis.has(u.upi)), ...data.users]
          setUsersList(merged)
        }
      })
      .catch(err => console.log('Failed to fetch users:', err))
  }, [])

  // Registration State
  const [isRegistering, setIsRegistering] = useState(false)
  const [regPhase, setRegPhase] = useState(1) // 1 to 5
  const [loading, setLoading] = useState(false)
  
  const [regData, setRegData] = useState({
    name: '', upi_id: '', phone_number: '', email: '',
    age: '', gender: 'Male', nationality: 'Indian', marital_status: 'Single', parents_name: '', pan_number: '', aadhaar_number: '',
    address: '', city: '', state: '', pin_code: '', country: 'India',
    occupation: 'Student', employment_type: 'Full-Time', employer_name: '', annual_income: '0-5L', source_of_income: 'Salary', account_type: 'Personal', purpose_of_account: 'Savings', annual_turnover: '0-5L', pep_declaration: false,
    nominee_name: '', nominee_relation: '', nominee_contact: '',
    consent_agreed: false, electronic_signature: ''
  })

  function handleLogin() {
    if (!selected) { setError('Select an account to continue'); return }
    if (pin !== '1234') { setError('Incorrect PIN — use 1234'); return }
    onLogin({ ...selected })
  }

  async function handleRegisterSubmit(e) {
    e.preventDefault()
    
    if (regPhase < 5) {
      setError('')
      setRegPhase(regPhase + 1)
      return
    }

    if (!regData.consent_agreed) {
      setError('You must agree to the Terms & Conditions')
      return
    }
    if (!regData.electronic_signature) {
      setError('Electronic Signature is required')
      return
    }

    // Submit Phase 5
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/kyc/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...regData,
          age: parseInt(regData.age || 18, 10)
        })
      });

      if (!res.ok) throw new Error('Registration failed')
      
      const newUser = {
        id: `USER_${Date.now()}`,
        name: regData.name,
        upi: regData.upi_id,
        role: 'Verified User',
        balance: 100000,
        avatar: regData.name.charAt(0).toUpperCase(),
        isController: false
      }

      const updatedUsers = [...usersList, newUser]
      setUsersList(updatedUsers)
      localStorage.setItem('neon_bank_users', JSON.stringify(updatedUsers))
      setIsRegistering(false)
      onLogin(newUser)
    } catch (err) {
      setError('Registration failed. Make sure backend is running on port 8000.')
    }
    setLoading(false)
  }

  const InputLabel = ({ children }) => <label className="text-xs text-on-surface-variant mb-1 block">{children}</label>
  const InputStyle = "w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-2.5 text-on-surface text-sm outline-none focus:border-secondary focus:shadow-[0_0_8px_rgba(0,255,204,0.2)]"

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-secondary/10 rounded-full blur-[100px]" />
      </div>

      <div className="w-full max-w-2xl relative z-10">
        <div className="text-center mb-8">
          <h1 className="font-headline font-black text-4xl tracking-tighter text-primary neon-glow-text drop-shadow-[0_0_12px_rgba(255,45,120,0.8)]">
            NEON BANK
          </h1>
          <p className="font-label text-on-surface-variant text-[10px] tracking-[0.3em] uppercase mt-2">Secure Payment Platform</p>
        </div>

        <div className="bg-surface-container rounded-2xl p-6 sm:p-8 neon-border shadow-2xl">
          {!isRegistering ? (
            <>
              <p className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase mb-5">Select Account</p>
              <div className="grid grid-cols-2 gap-3 mb-6 max-h-64 overflow-y-auto pr-2">
                {usersList.map(u => (
                  <button key={u.id} onClick={() => { setSelected(u); setError('') }}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 text-left ${
                      selected?.id === u.id
                        ? u.isController ? 'border-primary bg-primary/10 shadow-[0_0_16px_rgba(255,45,120,0.2)]' : 'border-secondary bg-secondary/10 shadow-[0_0_16px_rgba(0,255,204,0.1)]'
                        : 'border-outline-variant bg-surface-container-low hover:border-outline hover:bg-surface-container'
                    }`}>
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0"
                      style={{
                        background: u.isController ? 'linear-gradient(135deg, #ff2d78, #b3004e)' : '#1e1e30',
                        color: u.isController ? '#1a0010' : '#e8e0f0',
                        boxShadow: u.isController ? '0 0 12px rgba(255,45,120,0.4)' : 'none'
                      }}>{u.avatar}</div>
                    <div className="min-w-0">
                      <p className="text-on-surface text-sm font-medium truncate font-headline">{u.name}</p>
                      <p className={`text-[10px] font-label tracking-wider ${u.isController ? 'text-primary' : 'text-on-surface-variant'}`}>{u.role}</p>
                    </div>
                    {selected?.id === u.id && <span className="material-symbols-outlined ml-auto text-lg" style={{ color: u.isController ? '#ff2d78' : '#00ffcc' }}>check_circle</span>}
                  </button>
                ))}
              </div>

              <div className="mb-6">
                <label className="font-label text-on-surface-variant text-[10px] tracking-widest uppercase block mb-3">Enter PIN</label>
                <div className="flex gap-3 justify-center mb-4">
                  {[0,1,2,3].map(i => (
                    <div key={i} className="w-10 h-10 sm:w-12 sm:h-12 border border-outline-variant rounded-lg bg-surface-container-lowest flex items-center justify-center text-xl text-primary neon-glow-text">
                      {pin.length > i ? '●' : ''}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                  {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
                    <button key={i} onClick={() => {
                      if (k === '⌫') setPin(p => p.slice(0,-1))
                      else if (k !== '' && pin.length < 4) setPin(p => p + k)
                    }}
                      className={`h-10 sm:h-12 rounded-lg text-sm font-label font-medium transition-all duration-150 ${
                        k === '' ? 'invisible' : 'bg-surface-container border border-outline-variant text-on-surface hover:bg-surface-container-high hover:border-primary hover:shadow-[0_0_8px_rgba(255,45,120,0.2)] active:scale-95'
                      }`}>{k}</button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 mb-4 p-3 bg-error-container/30 border border-error/30 rounded-lg">
                  <span className="material-symbols-outlined text-error text-lg">error</span>
                  <p className="text-error text-xs font-body">{error}</p>
                </div>
              )}

              <button onClick={handleLogin} className="w-full py-3.5 bg-primary text-on-primary font-label font-bold text-sm tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(255,45,120,0.6)] active:scale-95 transition-all">
                ACCESS ACCOUNT
              </button>

              <div className="mt-6 text-center">
                <button onClick={() => { setIsRegistering(true); setError(''); setRegPhase(1) }} className="text-secondary text-sm font-medium hover:underline tracking-wide">
                  Create New Bank Account
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit}>
              <div className="flex justify-between items-center mb-6">
                <p className="font-label text-secondary text-[10px] tracking-widest uppercase">
                  Step {regPhase} of 5: {
                    regPhase === 1 ? 'Basic Details' :
                    regPhase === 2 ? 'Identity Verification' :
                    regPhase === 3 ? 'Residential Address' :
                    regPhase === 4 ? 'Employment & Finances' : 'Consent & Signature'
                  }
                </p>
                <div className="flex gap-4">
                  {regPhase > 1 && (
                    <button type="button" onClick={() => setRegPhase(r => r - 1)} className="text-on-surface-variant hover:text-on-surface text-xs font-label">
                      ← BACK
                    </button>
                  )}
                  <button type="button" onClick={() => setIsRegistering(false)} className="text-on-surface-variant hover:text-error text-xs font-label">
                    CANCEL
                  </button>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="flex gap-1 mb-6">
                {[1,2,3,4,5].map(step => (
                  <div key={step} className={`h-1.5 flex-1 rounded-full ${step <= regPhase ? 'bg-secondary shadow-[0_0_8px_rgba(0,255,204,0.4)]' : 'bg-surface-container-high'}`} />
                ))}
              </div>

              {/* Phase 1: Basic */}
              {regPhase === 1 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Full Name (As per ID)</InputLabel><input required type="text" className={InputStyle} value={regData.name} onChange={e => setRegData({...regData, name: e.target.value})} placeholder="Alex Smith" /></div>
                    <div className="flex-1"><InputLabel>UPI ID</InputLabel><input required type="text" className={InputStyle} value={regData.upi_id} onChange={e => setRegData({...regData, upi_id: e.target.value})} placeholder="alex@neon" /></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Mobile Number</InputLabel><input required type="tel" className={InputStyle} value={regData.phone_number} onChange={e => setRegData({...regData, phone_number: e.target.value})} placeholder="+91 9876543210" /></div>
                    <div className="flex-1"><InputLabel>Email Address</InputLabel><input required type="email" className={InputStyle} value={regData.email} onChange={e => setRegData({...regData, email: e.target.value})} placeholder="alex@example.com" /></div>
                  </div>
                </div>
              )}

              {/* Phase 2: Identity */}
              {regPhase === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Age</InputLabel><input required type="number" className={InputStyle} value={regData.age} onChange={e => setRegData({...regData, age: e.target.value})} placeholder="18" /></div>
                    <div className="flex-1"><InputLabel>Gender</InputLabel><select className={InputStyle} value={regData.gender} onChange={e => setRegData({...regData, gender: e.target.value})}><option>Male</option><option>Female</option><option>Other</option></select></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Marital Status</InputLabel><select className={InputStyle} value={regData.marital_status} onChange={e => setRegData({...regData, marital_status: e.target.value})}><option>Single</option><option>Married</option><option>Divorced</option></select></div>
                    <div className="flex-1"><InputLabel>Nationality</InputLabel><input type="text" className={InputStyle} value={regData.nationality} onChange={e => setRegData({...regData, nationality: e.target.value})} /></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>PAN Number</InputLabel><input required type="text" className={InputStyle} value={regData.pan_number} onChange={e => setRegData({...regData, pan_number: e.target.value})} placeholder="ABCDE1234F" /></div>
                    <div className="flex-1"><InputLabel>Aadhaar Number (Optional)</InputLabel><input type="text" className={InputStyle} value={regData.aadhaar_number} onChange={e => setRegData({...regData, aadhaar_number: e.target.value})} placeholder="0000 0000 0000" /></div>
                  </div>
                  <div><InputLabel>Father's/Mother's Name</InputLabel><input type="text" className={InputStyle} value={regData.parents_name} onChange={e => setRegData({...regData, parents_name: e.target.value})} /></div>
                </div>
              )}

              {/* Phase 3: Address */}
              {regPhase === 3 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div><InputLabel>Residential Address</InputLabel><input required type="text" className={InputStyle} value={regData.address} onChange={e => setRegData({...regData, address: e.target.value})} placeholder="123 Main St, Apt 4B" /></div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>City</InputLabel><input required type="text" className={InputStyle} value={regData.city} onChange={e => setRegData({...regData, city: e.target.value})} /></div>
                    <div className="flex-1"><InputLabel>State</InputLabel><input required type="text" className={InputStyle} value={regData.state} onChange={e => setRegData({...regData, state: e.target.value})} /></div>
                  </div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>PIN Code</InputLabel><input required type="text" className={InputStyle} value={regData.pin_code} onChange={e => setRegData({...regData, pin_code: e.target.value})} /></div>
                    <div className="flex-1"><InputLabel>Country</InputLabel><input required type="text" className={InputStyle} value={regData.country} onChange={e => setRegData({...regData, country: e.target.value})} /></div>
                  </div>
                  <div className="p-4 rounded-lg bg-surface-container-low border border-dashed border-outline-variant text-center mt-2">
                    <span className="material-symbols-outlined text-secondary mb-2 block">upload_file</span>
                    <p className="text-xs text-on-surface font-medium">Upload Document Front & Back</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">Aadhaar, Passport, or Voter ID (Max 5MB)</p>
                    <input type="file" className="mt-3 text-xs text-on-surface-variant file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-secondary/10 file:text-secondary hover:file:bg-secondary/20 cursor-pointer" />
                  </div>
                </div>
              )}

              {/* Phase 4: Employment & Financials */}
              {regPhase === 4 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Occupation</InputLabel><select className={InputStyle} value={regData.occupation} onChange={e => setRegData({...regData, occupation: e.target.value})}><option>Student</option><option>Salaried</option><option>Self-Employed</option><option>Business Owner</option><option>Retired</option></select></div>
                    <div className="flex-1"><InputLabel>Employment Type</InputLabel><select className={InputStyle} value={regData.employment_type} onChange={e => setRegData({...regData, employment_type: e.target.value})}><option>Full-Time</option><option>Part-Time</option><option>Contract</option></select></div>
                  </div>
                  <div><InputLabel>Employer/Company Name</InputLabel><input type="text" className={InputStyle} value={regData.employer_name} onChange={e => setRegData({...regData, employer_name: e.target.value})} placeholder="Optional for Students" /></div>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Annual Income Range</InputLabel><select className={InputStyle} value={regData.annual_income} onChange={e => setRegData({...regData, annual_income: e.target.value})}><option>0-5L</option><option>5L-15L</option><option>15L-50L</option><option>50L+</option></select></div>
                    <div className="flex-1"><InputLabel>Account Purpose</InputLabel><select className={InputStyle} value={regData.purpose_of_account} onChange={e => setRegData({...regData, purpose_of_account: e.target.value})}><option>Savings</option><option>Salary</option><option>Business</option><option>Investment</option></select></div>
                  </div>
                  <div className="flex items-center gap-2 mt-2 bg-surface-container-low p-3 rounded-lg border border-outline-variant">
                    <input type="checkbox" id="pep" className="accent-secondary w-4 h-4" checked={regData.pep_declaration} onChange={e => setRegData({...regData, pep_declaration: e.target.checked})} />
                    <label htmlFor="pep" className="text-xs text-on-surface-variant cursor-pointer">I declare that I am a Politically Exposed Person (PEP) or related to one.</label>
                  </div>
                </div>
              )}

              {/* Phase 5: Nominee & Consent */}
              {regPhase === 5 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <p className="text-xs font-medium text-secondary mb-2">Nominee Details (Optional)</p>
                  <div className="flex gap-4">
                    <div className="flex-1"><InputLabel>Nominee Name</InputLabel><input type="text" className={InputStyle} value={regData.nominee_name} onChange={e => setRegData({...regData, nominee_name: e.target.value})} /></div>
                    <div className="flex-1"><InputLabel>Relationship</InputLabel><input type="text" className={InputStyle} value={regData.nominee_relation} onChange={e => setRegData({...regData, nominee_relation: e.target.value})} /></div>
                  </div>
                  
                  <div className="w-full h-px bg-outline-variant my-4" />
                  
                  <p className="text-xs font-medium text-secondary mb-2">Consent & Declaration</p>
                  <div className="flex items-start gap-3 bg-surface-container-low p-4 rounded-lg border border-outline-variant">
                    <input type="checkbox" id="consent" className="accent-secondary w-4 h-4 mt-0.5" checked={regData.consent_agreed} onChange={e => setRegData({...regData, consent_agreed: e.target.checked})} />
                    <label htmlFor="consent" className="text-xs text-on-surface-variant leading-relaxed cursor-pointer">
                      I hereby declare that the details furnished above are true and correct to the best of my knowledge. I authorize Neon Bank to fetch my KYC details from central registries and process my data as per the privacy policy.
                    </label>
                  </div>
                  <div>
                    <InputLabel>Type your Full Name as Electronic Signature</InputLabel>
                    <input required type="text" className={`${InputStyle} font-headline italic tracking-wide`} value={regData.electronic_signature} onChange={e => setRegData({...regData, electronic_signature: e.target.value})} placeholder="Alex Smith" />
                  </div>
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2 mt-4 p-3 bg-error-container/30 border border-error/30 rounded-lg">
                  <span className="material-symbols-outlined text-error text-lg">error</span>
                  <p className="text-error text-xs font-body">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full mt-6 py-3.5 bg-secondary text-on-secondary font-label font-bold text-sm tracking-widest uppercase rounded-lg hover:shadow-[0_0_20px_rgba(0,255,204,0.6)] active:scale-95 transition-all">
                {loading ? 'PROCESSING...' : (regPhase < 5 ? 'NEXT STEP' : 'SUBMIT APPLICATION')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
