
import React, { useState, useEffect } from 'react';
import { API_URL, APP_TITLE } from './constants';
import { SearchResult, FormData } from './types';

const TUTORIAL_URL = "https://drive.google.com/file/d/1pO-BADnvdbjUqSkUPrlLnFG1EeQJxbZl/view";

// --- MAIN COMPONENT ---
export default function App() {
  // Application State
  const [view, setView] = useState<'SEARCH' | 'LOADING' | 'REPORT' | 'SUCCESS'>('SEARCH');
  const [empId, setEmpId] = useState('');
  const [data, setData] = useState<SearchResult | null>(null);
  
  // Modal for OTP
  const [showOtpModal, setShowOtpModal] = useState(false);

  // Form State
  const [form, setForm] = useState<FormData>({
    empId: '',
    supId: '',
    otDutyDays: '',
    totalOtHours: '',
    totalHolidayDays: '',
    totalHolidayHours: '',
  });
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);

  // OTP State
  const [otpInput, setOtpInput] = useState('');
  const [timer, setTimer] = useState(0);
  const [otpLoading, setOtpLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);

  // --- VALIDATION HELPERS ---

  const validateTimeFormat = (val: string) => {
    // Matches [h]:mm where mm is 00-59
    return /^\d+:[0-5]\d$/.test(val);
  };

  const isInteger = (val: string) => {
    return /^\d+$/.test(val);
  };

  const getDaysInMonth = (monthYearStr: string) => {
    if (monthYearStr.includes('February')) return 28;
    if (monthYearStr.includes('April') || monthYearStr.includes('June') || monthYearStr.includes('September') || monthYearStr.includes('November')) return 30;
    return 31;
  };

  // --- ACTIONS ---

  const handleSearch = async () => {
    if (!empId.trim()) return alert("Please Enter an Employee ID");
    
    setView('LOADING');
    try {
      const response = await fetch(`${API_URL}?action=search&id=${empId}`);
      const res: SearchResult = await response.json();
      
      if (!res.found) {
        alert("Employee ID Not Found in Database");
        setView('SEARCH');
        return;
      }

      setData(res);
      setForm(prev => ({ 
        ...prev, 
        empId: res.info?.id || '',
        otDutyDays: '0',
        totalOtHours: '0:00',
        totalHolidayDays: '0',
        totalHolidayHours: '0:00'
      }));
      setView('REPORT');
    } catch (e) {
      alert("Connection Error. Please check your internet.\nDetails: " + e);
      setView('SEARCH');
    }
  };

  const initiateOtp = async () => {
    const monthYear = data?.monthName || 'December 2025';
    const maxMonthDays = getDaysInMonth(monthYear);
    const maxHolidayDays = 7; 

    // 1. Basic Validations
    if (!agreed) return alert("Please read the notes and check the agreement box.");
    if (!form.supId) return alert("Please enter Supervisor ID.");
    if (!email.includes('@')) return alert("Please enter a valid official email address.");
    if (!isInteger(form.otDutyDays)) return alert("Overtime Duty Days must be an integer.");
    if (parseInt(form.otDutyDays) > maxMonthDays) return alert(`Overtime Duty Days cannot exceed ${maxMonthDays} days.`);
    if (!validateTimeFormat(form.totalOtHours)) return alert("Overtime Hours must be in [h]:mm format (e.g., 10:30).");
    if (!isInteger(form.totalHolidayDays)) return alert("Holiday/Weekend Days must be an integer.");
    if (parseInt(form.totalHolidayDays) > maxHolidayDays) return alert(`Holiday/Weekend Days cannot exceed ${maxHolidayDays} days.`);
    if (!validateTimeFormat(form.totalHolidayHours)) return alert("Holiday Hours must be in [h]:mm format (e.g., 8:00).");

    setOtpLoading(true);

    try {
      // 2. NEW: Duplicate Check BEFORE sending OTP
      const checkResponse = await fetch(`${API_URL}?action=checkDuplicate&id=${form.empId}`);
      const checkRes = await checkResponse.json();

      if (checkRes.exists) {
        const confirmOverwrite = window.confirm(
          `⚠️ WARNING: DUPLICATE ENTRY\n\n` +
          `An entry for ID ${form.empId} already exists.\n` +
          `Last submitted by: ${checkRes.previousUser}\n\n` +
          `Do you want to REPLACE the existing record with this new data?`
        );
        
        if (!confirmOverwrite) {
          setOtpLoading(false);
          return; // Stop the process if they click 'Cancel'
        }
      }

      // 3. Proceed to send OTP if no duplicate OR user clicked 'OK'
      const response = await fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({ action: 'sendOtp', email: email })
      });
      const res = await response.json();
      
      setOtpLoading(false);
      if (res.success) {
        setShowOtpModal(true);
        setOtpInput('');
        startTimer(120);
      } else {
        alert("Error sending email: " + res.message);
      }
    } catch (e) {
      setOtpLoading(false);
      alert("System Error: " + e);
    }
  };

  const verifyOtp = async () => {
    setVerifyLoading(true);
    try {
      const response = await fetch(API_URL, { 
        method: 'POST', 
        body: JSON.stringify({ action: 'verify', email, otp: otpInput, formData: form }) 
      });
      const res = await response.json();
      setVerifyLoading(false);
      if (res.success) {
        setShowOtpModal(false);
        setView('SUCCESS');
      } else {
        alert("❌ " + res.message);
      }
    } catch (e) {
      setVerifyLoading(false);
      alert("Verification Failed: " + e);
    }
  };

  const startTimer = (seconds: number) => setTimer(seconds);
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer(t => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    
    // Strict pattern matching for inputs
    if (id === 'totalOtHours' || id === 'totalHolidayHours') {
      // Allow only numbers and colons
      const filtered = value.replace(/[^0-9:]/g, '');
      // Prevent more than one colon
      if ((filtered.match(/:/g) || []).length > 1) return;
      setForm(prev => ({ ...prev, [id]: filtered }));
    } else if (id === 'otDutyDays' || id === 'totalHolidayDays') {
      // Allow only numbers (integers)
      const filtered = value.replace(/[^0-9]/g, '');
      setForm(prev => ({ ...prev, [id]: filtered }));
    } else {
      setForm(prev => ({ ...prev, [id]: value }));
    }
  };

  // NEW: Formatting logic on blur for time fields
  const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (!value) return;

    let formatted = value;
    // Handle integer entry (e.g., "24" -> "24:00")
    if (/^\d+$/.test(value)) {
      formatted = `${value}:00`;
    } 
    // Handle trailing colon (e.g., "24:" -> "24:00")
    else if (value.endsWith(':')) {
      formatted = `${value}00`;
    }
    // Handle single digit minutes (e.g., "24:3" -> "24:03") to ensure [h]:mm format
    else if (/^\d+:\d$/.test(value)) {
      const [h, m] = value.split(':');
      formatted = `${h}:${m.padStart(2, '0')}`;
    }

    setForm(prev => ({ ...prev, [id]: formatted }));
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    // Use a small timeout to ensure the UI is not busy
    setTimeout(() => {
      window.print();
    }, 150);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 md:p-8 rounded-xl shadow-2xl my-4 container">
      
      {/* BRANDED HEADER (SEARCH & REPORT) */}
      {view !== 'SUCCESS' && (
        <div className="mb-8">
           {/* CENTERED TITLE */}
           <div className="text-center border-b-4 border-[#006a4e] pb-4 mb-6">
              <h1 id="mainTitle" className="text-2xl md:text-3xl font-extrabold text-[#006a4e] uppercase tracking-wide">
                {view === 'REPORT' ? `Holiday and Overtime Review: ${data?.monthName}` : APP_TITLE}
              </h1>
           </div>
        </div>
      )}

      {/* SEARCH VIEW */}
      {view === 'SEARCH' && (
        <div id="searchSection" className="flex flex-col gap-6">
          <div className="max-w-lg mx-auto w-full space-y-4">
             <input 
               type="text" 
               value={empId}
               onChange={(e) => setEmpId(e.target.value)}
               placeholder="Enter Employee ID" 
               className="w-full p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#006a4e]/20 focus:border-[#006a4e] transition-all text-lg text-center font-bold"
               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
             />
             <button 
               onClick={handleSearch} 
               className="w-full bg-[#006a4e] text-white py-4 rounded-xl font-black text-xl hover:bg-[#00523c] transition shadow-xl transform hover:scale-[1.02] active:scale-95 uppercase tracking-widest"
             >
               Search Records
             </button>
          </div>

          <div className="bg-[#f0f9f6] p-6 rounded-2xl border-2 border-[#006a4e]/20 text-left shadow-inner">
            <h3 className="text-xl font-bold mb-4 text-[#006a4e] flex items-center gap-2 border-b border-[#006a4e]/10 pb-2">
              <span className="text-2xl">📝</span> গুরুত্বপূর্ণ নির্দেশনা
            </h3>
            <ul className="list-decimal pl-6 space-y-4 text-gray-800 text-base md:text-lg font-medium leading-relaxed">
              <li>হলিডে/উইকেন্ড ডিউটি এবং ওভারটাইম ডিউটি সুপারিশ করার পর সংশ্লিষ্ট রিপোর্ট প্রিন্ট করতে হবে এবং কর্মী ও সুপারভাইজার উভয়ের স্বাক্ষর গ্রহণ করতে হবে।</li>
              <li>প্রিন্ট কপিতে উল্লেখিত তথ্য এবং অনলাইনে সাবমিট করা তথ্য যেন একই হয়—এটি নিশ্চিত করতে হবে।</li>
            </ul>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
             <a href={TUTORIAL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#006a4e] font-bold hover:underline text-lg">
                🎥 Video Tutorial (ভিডিও টিউটোরিয়াল দেখুন)
             </a>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-sm md:text-base text-gray-700">
             <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
               📌 বিশেষ দ্রষ্টব্য:
             </h4>
             <p className="mb-4">কোনো যোগ্য কর্মীর অ্যাটেনডেন্স পোর্টালে পাওয়া না গেলে, অথবা তালিকায় নাম না থাকলেও অনুমোদিত ওভারটাইম বা হলিডে ডিউটি থাকলে— অনুগ্রহ করে যোগাযোগ করুনঃ</p>
             <div className="font-bold text-[#006a4e] bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                মোঃ নাদিম হোসেন <br/>
                সিনিয়র অফিসার, এইচআর <br/>
                ফোনঃ <span className="text-blue-700">01847334930</span> | এক্সটেনশনঃ <span className="text-blue-700">65187</span>
             </div>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {view === 'LOADING' && (
        <div id="loader" className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#006a4e] border-t-transparent mb-4"></div>
          <p className="text-[#006a4e] font-bold text-xl animate-pulse">Searching employee records...</p>
        </div>
      )}

      {/* REPORT VIEW */}
      {view === 'REPORT' && data && (
        <div id="resultArea">
          <div className="bg-[#f0f9f6] p-4 rounded-lg mb-6 border border-[#006a4e]/20 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 block text-xs uppercase font-bold">ID</span><strong className="text-[#006a4e] text-base">{data.info?.id}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">Name</span><strong className="text-gray-800">{data.info?.name}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">Designation</span><strong className="text-gray-800">{data.info?.designation}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">Department</span><strong className="text-gray-800">{data.info?.department}</strong></div>
          </div>

          <div className="overflow-x-auto mb-8 border-2 border-gray-100 rounded-xl shadow-lg">
            <table className="w-full text-sm text-left text-gray-700 whitespace-nowrap">
              <thead className="text-xs text-white uppercase bg-[#006a4e] print:text-black print:bg-gray-200">
                <tr>
                  <th className="px-4 py-4">Date</th>
                  <th className="px-4 py-4">Day</th>
                  <th className="px-4 py-4">Sch In</th>
                  <th className="px-4 py-4">Sch Out</th>
                  <th className="px-4 py-4">In</th>
                  <th className="px-4 py-4">Out</th>
                  <th className="px-4 py-4">Total</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.records?.map((r, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-semibold">{r.date}</td>
                    <td className="p-4">{r.day}</td>
                    <td className="p-4">{r.schIn}</td>
                    <td className="p-4">{r.schOut}</td>
                    <td className="p-4">{r.chkIn}</td>
                    <td className="p-4">{r.chkOut}</td>
                    <td className="p-4">{r.total}</td>
                    <td className="p-4 font-bold text-[#006a4e]">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border-2 border-gray-100 shadow-inner">
            <h3 className="text-xl font-bold text-gray-900 border-b-2 border-[#006a4e] pb-2 mb-4">
              Review Summary: {data.info?.name} - {data.dateRange}
            </h3>
            <p className="text-sm text-[#006a4e] mb-6 font-bold leading-relaxed">
              Common Holiday Count = 03 Days, Common Weekend = 04 Days <br /> Weekdays/Working Days = 24 Days
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {[
                { 
                  id: 'otDutyDays', 
                  label: `Total Overtime Duty Days in ${data.monthName || 'December 2025'}`, 
                  sub: `[${data.monthName || 'ডিসেম্বর ২০২৫'} মাসে মোট কয়দিন উনাকে ওভারটাইম ডিউটির অনুমতি দিয়েছিলেন?]`,
                  type: 'text',
                  placeholder: 'e.g. 5'
                },
                { 
                  id: 'totalOtHours', 
                  label: `Total Overtime Hours in ${data.monthName || 'December 2025'}`, 
                  sub: `[${data.monthName || 'ডিসেম্বর ২০২৫'} মাসে সর্বমোট ওভারটাইম ঘন্টা]`,
                  type: 'text',
                  placeholder: 'h:mm',
                  useTimeBlur: true
                },
                { 
                  id: 'totalHolidayDays', 
                  label: 'Total Holiday/Weekend Days', 
                  sub: '[এই মাসে উনার মোট হলিডে বা উইকেন্ড ডিউটি কতদিন?]',
                  type: 'text',
                  placeholder: 'e.g. 3'
                },
                { 
                  id: 'totalHolidayHours', 
                  label: 'Total Holiday Hours (Maximum 8 hours per day)', 
                  sub: '[ দিনে সর্বোচ্চ ৮ ঘন্টা হিসাবে এই মাসে উনার মোট হলিডে বা উইকেন্ড ডিউটি কতঘন্টা?]',
                  type: 'text',
                  placeholder: 'h:mm',
                  useTimeBlur: true
                },
              ].map((field) => (
                <div key={field.id} className="space-y-2">
                  <label className="block font-black text-gray-800 text-base">{field.label}</label>
                  <span className="sub-label no-print block text-[#006a4e] font-bold text-sm">{field.sub}</span>
                  <input 
                    type={field.type} 
                    id={field.id}
                    value={(form as any)[field.id]}
                    onChange={handleInputChange}
                    onBlur={field.useTimeBlur ? handleTimeBlur : undefined}
                    className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-[#006a4e]/10 focus:border-[#006a4e] outline-none font-bold text-lg" 
                    placeholder={field.placeholder || "0"} 
                  />
                </div>
              ))}
            </div>

            <div className="mb-8 p-5 bg-red-50 border-l-8 border-red-500 rounded-lg text-sm md:text-base text-gray-900 no-print">
               <h4 className="font-black text-red-700 mb-3 text-lg">গুরুত্বপূর্ণ নোট:</h4>
               <ul className="list-decimal pl-6 space-y-2 font-semibold">
                <li>যেকোনো হলিডে বা ওভারটাইম ডিউটি বিলের ক্ষেত্রে উপস্থিতির পাঞ্চ বাধ্যতামূলক।</li>
                <li>সুপারভাইজারের রিকমেন্ডেশন অবশ্যই উক্ত এমপ্লয়ীর জন্য ম্যানেজমেন্ট প্রদত্ত অনুমোদনের সঙ্গে সামঞ্জস্যপূর্ণ হতে হবে।</li>
                <li>উপস্থিতির পাঞ্চ থাকলেও সুপারভাইজার এর রিকমেন্ডেশন ব্যতীত হলিডে বা ওভারটাইম ডিউটি বিল প্রদান করা হবে না।</li>
               </ul>
            </div>

            <label id="termsCheckboxLabel" className="flex items-center gap-4 mb-8 font-black cursor-pointer p-5 bg-white border-2 border-[#006a4e]/20 rounded-xl hover:bg-[#f0f9f6] no-print transition-colors">
              <input 
                type="checkbox" 
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-7 h-7 accent-[#006a4e]" 
              /> 
              <span className="text-gray-900 uppercase tracking-tighter">I have read and agreed to the above terms.</span>
            </label>

            <div id="supervisorInputSection" className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-gray-200 pt-8 no-print">
               <div>
                 <label className="block font-black text-gray-800 mb-2">Supervisor ID</label>
                 <input 
                   type="text" 
                   id="supId"
                   value={form.supId}
                   onChange={handleInputChange}
                   className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-[#006a4e]/10 focus:border-[#006a4e] outline-none font-bold" 
                   placeholder="Enter Your ID" 
                 />
               </div>
               <div>
                 <label className="block font-black text-gray-800 mb-2">Supervisor Official Email</label>
                 <input 
                   type="email" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-[#006a4e]/10 focus:border-[#006a4e] outline-none font-bold" 
                   placeholder="supervisor@company.com" 
                 />
               </div>
            </div>

            <div id="printSignatures" className="hidden justify-between mt-24 pt-12">
              <div className="text-center">
                <div className="w-56 border-t-2 border-black pt-2 font-black text-lg">Signature of Employee</div>
              </div>
              <div className="text-left">
                <div className="w-72 border-t-2 border-black pt-2 font-black text-lg">Signature of Supervisor</div>
                <div className="mt-6 text-base font-bold">ID: __________________________</div>
                <div className="mt-6 text-base font-bold">Date: ________________________</div>
              </div>
            </div>

            <div className="mt-12 text-center no-print">
               <p className="text-xl md:text-3xl font-black text-[#006a4e] mb-6 px-10 py-6 border-4 border-dashed border-[#006a4e] rounded-3xl inline-block bg-white shadow-2xl animate-pulse">
                Please print the report before submit online. <br/>
                <span className="text-lg md:text-2xl font-bold">[অনলাইনে রিপোর্টটি সাবমিট করার পূর্বে প্রিন্ট করে নিন]</span>
               </p>
            </div>

            <div className="mt-8 flex flex-col sm:flex-row justify-end gap-6 no-print">
              <button 
                id="printBtn"
                type="button"
                onClick={handlePrint} 
                className="bg-gray-800 text-white px-10 py-4 rounded-xl hover:bg-black font-black text-lg shadow-xl transition transform hover:scale-105 flex items-center justify-center gap-3"
              >
                🖨️ Print Report
              </button>
              
              <button 
                id="otpBtn"
                type="button"
                onClick={initiateOtp} 
                disabled={otpLoading}
                className="bg-[#16a34a] text-white px-12 py-4 rounded-xl hover:bg-[#11803a] font-black text-lg shadow-xl transition transform hover:scale-105 disabled:opacity-50"
              >
                {otpLoading ? "Sending Code..." : "Request OTP & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS STATE */}
      {view === 'SUCCESS' && (
        <div id="successPage" className="text-center py-20">
          <div className="checkmark-circle"><span className="checkmark">✔</span></div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 uppercase tracking-widest">Success!</h2>
          <p className="text-gray-700 text-xl mb-12 font-bold">Your submission has been recorded successfully.</p>
          <button 
            type="button"
            onClick={() => window.location.reload()} 
            className="bg-[#006a4e] text-white px-10 py-4 rounded-xl hover:bg-[#00523c] font-black text-lg shadow-xl transition transform hover:scale-105"
          >
            Review Another Employee
          </button>
        </div>
      )}

      {/* OTP MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-md no-print p-4">
          <div className="bg-white p-10 rounded-3xl text-center w-full max-w-md shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border-t-8 border-[#006a4e]">
            <h3 className="text-3xl font-black mb-4 text-gray-900">VERIFY ACCESS</h3>
            <p className="text-base text-gray-600 mb-8 font-bold italic">Check your official email for the 6-digit code.</p>
            
            <input 
              type="text" 
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              className="text-center text-5xl mb-8 font-black border-b-4 border-[#006a4e] focus:border-green-500 w-full py-3 tracking-[0.6em] outline-none text-[#006a4e]" 
              maxLength={6} 
              placeholder="000000" 
            />
            
            <div className={`text-2xl font-black mb-10 p-3 rounded-lg inline-block px-8 ${timer > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              {timer > 0 ? formatTime(timer) : "EXPIRED"}
            </div>
            
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setShowOtpModal(false)} 
                className="flex-1 py-4 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 font-black uppercase"
              >
                Back
              </button>
              <button 
                type="button"
                onClick={verifyOtp} 
                disabled={timer === 0 || verifyLoading}
                className="flex-[2] py-4 bg-[#16a34a] text-white rounded-xl hover:bg-[#11803a] font-black shadow-lg disabled:opacity-50 uppercase tracking-widest"
              >
                {verifyLoading ? "Verifying..." : "Confirm Code"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
