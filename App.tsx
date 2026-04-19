import React, { useState, useEffect } from 'react';

// --- CONSTANTS & TYPES ---
const API_URL = "https://script.google.com/macros/s/AKfycbyGvPes-Dg7Mzh2_Sr_NbZ_AA3fD2NQTka5n9EeLAQ23kFHorDMoWxAdthLStwHa3H0XA/exec"; 
const APP_TITLE = "DIU Overtime Automation Engine";
const TUTORIAL_URL = "https://drive.google.com/file/d/1pO-BADnvdbjUqSkUPrlLnFG1EeQJxbZl/view";

interface SearchResult {
  found: boolean;
  info?: {
    id: string;
    name: string;
    designation: string;
    department: string;
  };
  records?: {
    date: string;
    day: string;
    schIn: string;
    schOut: string;
    chkIn: string;
    chkOut: string;
    total: string;
    status: string;
  }[];
  monthName?: string;
  dateRange?: string;
}

interface FormData {
  empId: string;
  supId: string;
  otDutyDays: string;
  totalOtHours: string;
  totalHolidayDays: string;
  totalHolidayHours: string;
}

interface SystemConfig {
  month: string;
  year: string;
  weekend: string;
  holiday: string;
  commonShift: string;
  specialShift: string;
  [key: string]: string | undefined; // Allows completely dynamic keys from the sheet
}

// --- MAIN COMPONENT ---
export default function App() {
  // Application State
  const [view, setView] = useState<'SEARCH' | 'LOADING' | 'REPORT' | 'SUCCESS'>('SEARCH');
  const [empId, setEmpId] = useState('');
  const [data, setData] = useState<SearchResult | null>(null);
  
  // Dynamic Configuration State
  const [sysConfig, setSysConfig] = useState<SystemConfig | null>(null);

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

  // Helper to check if URL is configured properly
  const isApiConfigured = () => {
    return API_URL && API_URL.startsWith('https://');
  };

  // --- TRANSLATION / DYNAMIC TEXT HELPER ---
  const t = (key: string, defaultText: string) => {
    if (sysConfig && sysConfig[key]) {
      return sysConfig[key];
    }
    return defaultText;
  };

  // --- FETCH CONFIGURATION ON LOAD ---
  useEffect(() => {
    const fetchConfig = async () => {
      if (!isApiConfigured()) return;

      try {
        const response = await fetch(`${API_URL}?action=getConfig`);
        const text = await response.text();
        
        try {
          const res = JSON.parse(text);
          if (res.success) {
            setSysConfig(res.data);
          }
        } catch (parseError) {
          console.error("Failed to parse config JSON.", text);
        }
      } catch (e) {
        console.error("Failed to load system config", e);
      }
    };
    fetchConfig();
  }, []);

  // --- VALIDATION HELPERS ---
  const validateTimeFormat = (val: string) => {
    return /^\d+:[0-5]\d$/.test(val);
  };

  const isInteger = (val: string) => {
    return /^\d+$/.test(val);
  };

  const getDaysInMonth = (monthStr: string, yearStr: string) => {
    const m = monthStr.toLowerCase();
    if (m.includes('february')) {
      const y = parseInt(yearStr);
      return (y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0)) ? 29 : 28;
    }
    if (['april', 'june', 'september', 'november'].some(x => m.includes(x))) return 30;
    return 31;
  };

  // --- ACTIONS ---
  const handleSearch = async () => {
    if (!isApiConfigured()) {
      return alert("⚠️ CONFIGURATION REQUIRED\n\nPlease update the API_URL variable in your code to your real Apps Script deployment link.");
    }

    if (!empId.trim()) return alert(t('errorEmptyId', "Please Enter an Employee ID"));
    
    setView('LOADING');
    try {
      const response = await fetch(`${API_URL}?action=search&id=${empId}`);
      const text = await response.text();
      
      let res: SearchResult;
      try {
        res = JSON.parse(text);
      } catch (err) {
        throw new Error(`Expected JSON but received HTML. Make sure your Apps Script Web App is deployed as "Execute as: Me" and "Who has access: Anyone".`);
      }
      
      if (!res.found) {
        alert(t('errorIdNotFound', "Employee ID Not Found in Database"));
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
    } catch (e: any) {
      alert(t('errorConnection', "Connection Error. Please check your internet or URL.\nDetails: ") + e.message);
      setView('SEARCH');
    }
  };

  const initiateOtp = async () => {
    const maxMonthDays = sysConfig ? getDaysInMonth(sysConfig.month, sysConfig.year) : 31;
    const maxHolidayDays = 15; 

    if (!agreed) return alert(t('valAgree', "Please read the notes and check the agreement box."));
    if (!form.supId) return alert(t('valSupId', "Please enter Supervisor ID."));
    if (!email.includes('@')) return alert(t('valEmail', "Please enter a valid official email address."));
    if (!isInteger(form.otDutyDays)) return alert(t('valOtDaysInt', "Overtime Duty Days must be an integer."));
    if (parseInt(form.otDutyDays) > maxMonthDays) return alert(t('valOtDaysMax', `Overtime Duty Days cannot exceed ${maxMonthDays} days for this month.`));
    if (!validateTimeFormat(form.totalOtHours)) return alert(t('valOtHrsFmt', "Overtime Hours must be in [h]:mm format (e.g., 10:30)."));
    if (!isInteger(form.totalHolidayDays)) return alert(t('valHolDaysInt', "Holiday/Weekend Days must be an integer."));
    if (parseInt(form.totalHolidayDays) > maxHolidayDays) return alert(t('valHolDaysMax', `Holiday/Weekend Days cannot exceed 15 days.`));
    if (!validateTimeFormat(form.totalHolidayHours)) return alert(t('valHolHrsFmt', "Holiday Hours must be in [h]:mm format (e.g., 8:00)."));

    setOtpLoading(true);

    try {
      const checkResponse = await fetch(`${API_URL}?action=checkDuplicate&id=${form.empId}`);
      const checkText = await checkResponse.text();
      let checkRes;
      try {
        checkRes = JSON.parse(checkText);
      } catch(e) {
        throw new Error("Invalid response during duplicate check.");
      }

      if (checkRes.exists) {
        const confirmOverwrite = window.confirm(
          `⚠️ ${t('dupWarningTitle', 'WARNING: DUPLICATE ENTRY')}\n\n` +
          `${t('dupWarningMsg1', 'An entry for ID')} ${form.empId} ${t('dupWarningMsg2', 'already exists.')}\n` +
          `${t('dupWarningMsg3', 'Last submitted by:')} ${checkRes.previousUser}\n\n` +
          `${t('dupWarningMsg4', 'Do you want to REPLACE the existing record with this new data?')}`
        );
        
        if (!confirmOverwrite) {
          setOtpLoading(false);
          return;
        }
      }

      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', 
        },
        body: JSON.stringify({ action: 'sendOtp', email: email })
      });
      const text = await response.text();
      const res = JSON.parse(text);
      
      setOtpLoading(false);
      if (res.success) {
        setShowOtpModal(true);
        setOtpInput('');
        startTimer(120);
      } else {
        alert(t('errorEmailSend', "Error sending email: ") + res.message);
      }
    } catch (e: any) {
      setOtpLoading(false);
      alert(t('errorSystem', "System Error: ") + e.message);
    }
  };

  const verifyOtp = async () => {
    setVerifyLoading(true);
    try {
      const response = await fetch(API_URL, { 
        method: 'POST', 
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify({ action: 'verify', email, otp: otpInput, formData: form }) 
      });
      const text = await response.text();
      const res = JSON.parse(text);
      
      setVerifyLoading(false);
      if (res.success) {
        setShowOtpModal(false);
        setView('SUCCESS');
      } else {
        alert("❌ " + res.message);
      }
    } catch (e: any) {
      setVerifyLoading(false);
      alert(t('errorVerification', "Verification Failed: ") + e.message);
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
    
    if (id === 'totalOtHours' || id === 'totalHolidayHours') {
      const filtered = value.replace(/[^0-9:]/g, '');
      if ((filtered.match(/:/g) || []).length > 1) return;
      setForm(prev => ({ ...prev, [id]: filtered }));
    } else if (id === 'otDutyDays' || id === 'totalHolidayDays') {
      const filtered = value.replace(/[^0-9]/g, '');
      setForm(prev => ({ ...prev, [id]: filtered }));
    } else {
      setForm(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleTimeBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    if (!value) return;

    let formatted = value;
    if (/^\d+$/.test(value)) {
      formatted = `${value}:00`;
    } 
    else if (value.endsWith(':')) {
      formatted = `${value}00`;
    }
    else if (/^\d+:\d$/.test(value)) {
      const [h, m] = value.split(':');
      formatted = `${h}:${m.padStart(2, '0')}`;
    }

    setForm(prev => ({ ...prev, [id]: formatted }));
  };

  const handlePrint = (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeout(() => {
      window.print();
    }, 150);
  };

  // Helper variables for dynamic text
  const targetMonthText = sysConfig ? `${sysConfig.month} ${sysConfig.year}` : 'Current Month';
  
  // Logic for Special Shift Check
  const isSpecialShiftNA = !sysConfig?.specialShift || sysConfig.specialShift.trim().toUpperCase() === 'N/A';
  
  const holidayHoursLabel = isSpecialShiftNA 
    ? `4. ${t('field4LabelNormal', 'Total Holiday/Weekend Duty Hours in')} ${targetMonthText} (${sysConfig?.commonShift || '8 Hours'}/day)`
    : `4. ${t('field4LabelSpecial', 'Total Holiday/Weekend Duty Hours in')} ${targetMonthText} (${sysConfig?.commonShift || '8 Hours'}/day for usual days, ${sysConfig?.specialShift || '6:30 Hours'}/day for special/Ramadan)`;

  const holidayHoursSub = isSpecialShiftNA
    ? `[${targetMonthText} ${t('field4SubNormal', 'মাসে উনার মোট হলিডে বা উইকেন্ড ডিউটি কতঘন্টা? (একদিনে সর্বোচ্চ ৮ ঘন্টা হিসেবে)')}]`
    : `[${targetMonthText} ${t('field4SubSpecial', `মাসে উনার মোট হলিডে বা উইকেন্ড ডিউটি কতঘন্টা? (সাধারণ শিফট ${sysConfig?.commonShift || '৮ ঘন্টা'}/দিন এবং বিশেষ শিফট ${sysConfig?.specialShift || '৬ঃ৩০ ঘন্টা'}/দিন হিসেবে)`)}]`;

  return (
    <div className="max-w-4xl mx-auto bg-white p-4 md:p-8 rounded-xl shadow-2xl my-4 container">
      
      {/* BRANDED HEADER */}
      {view !== 'SUCCESS' && (
        <div className="mb-8">
           <div className="text-center border-b-4 border-[#006a4e] pb-4 mb-6">
              <h1 id="mainTitle" className="text-2xl md:text-3xl font-extrabold text-[#006a4e] uppercase tracking-wide">
                {view === 'REPORT' 
                  ? `${t('reportTitleBase', 'Holiday and Overtime Review:')} ${targetMonthText}` 
                  : t('appTitle', APP_TITLE)}
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
               placeholder={t('searchPlaceholder', "Enter Employee ID")} 
               className="w-full p-4 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-[#006a4e]/20 focus:border-[#006a4e] transition-all text-lg text-center font-bold"
               onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
             />
             <button 
               onClick={handleSearch} 
               className="w-full bg-[#006a4e] text-white py-4 rounded-xl font-black text-xl hover:bg-[#00523c] transition shadow-xl transform hover:scale-[1.02] active:scale-95 uppercase tracking-widest"
             >
               {t('searchBtn', "Search Records")}
             </button>
          </div>

          <div className="bg-[#f0f9f6] p-6 rounded-2xl border-2 border-[#006a4e]/20 text-left shadow-inner">
            <h3 className="text-xl font-bold mb-4 text-[#006a4e] flex items-center gap-2 border-b border-[#006a4e]/10 pb-2">
              <span className="text-2xl">📝</span> {t('instructionTitle', "গুরুত্বপূর্ণ নির্দেশনা")}
            </h3>
            <ul className="list-decimal pl-6 space-y-4 text-gray-800 text-base md:text-lg font-medium leading-relaxed">
              <li>{t('instruction1', "হলিডে/উইকেন্ড ডিউটি এবং ওভারটাইম ডিউটি সুপারিশ করার পর সংশ্লিষ্ট রিপোর্ট প্রিন্ট করতে হবে এবং কর্মী ও সুপারভাইজার উভয়ের স্বাক্ষর গ্রহণ করতে হবে।")}</li>
              <li>{t('instruction2', "প্রিন্ট কপিতে উল্লেখিত তথ্য এবং অনলাইনে সাবমিট করা তথ্য যেন একই হয়—এটি নিশ্চিত করতে হবে।")}</li>
            </ul>
          </div>

          <div className="flex flex-col items-center gap-4 py-4">
             <a href={t('tutorialUrl', TUTORIAL_URL)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[#006a4e] font-bold hover:underline text-lg">
                {t('tutorialText', "🎥 Video Tutorial (ভিডিও টিউটোরিয়াল দেখুন)")}
             </a>
          </div>

          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 text-sm md:text-base text-gray-700">
             <h4 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                {t('noteTitle', "📌 বিশেষ দ্রষ্টব্য:")}
             </h4>
             <p className="mb-4">{t('noteDesc', "কোনো যোগ্য কর্মীর অ্যাটেনডেন্স পোর্টালে পাওয়া না গেলে, অথবা তালিকায় নাম না থাকলেও অনুমোদিত ওভারটাইম বা হলিডে ডিউটি থাকলে— অনুগ্রহ করে যোগাযোগ করুনঃ")}</p>
             <div className="font-bold text-[#006a4e] bg-white p-4 rounded-lg border border-gray-100 shadow-sm">
                {t('contactName', "মোঃ নাদিম হোসেন")} <br/>
                {t('contactDesig', "সিনিয়র অফিসার, এইচআর")} <br/>
                {t('contactPhoneLabel', "ফোনঃ")} <span className="text-blue-700">{t('contactPhone', "01847334930")}</span> | {t('contactExtLabel', "এক্সটেনশনঃ")} <span className="text-blue-700">{t('contactExt', "65187")}</span>
             </div>
          </div>
        </div>
      )}

      {/* LOADING STATE */}
      {view === 'LOADING' && (
        <div id="loader" className="text-center py-20">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-[#006a4e] border-t-transparent mb-4"></div>
          <p className="text-[#006a4e] font-bold text-xl animate-pulse">{t('loadingText', "Searching employee records...")}</p>
        </div>
      )}

      {/* REPORT VIEW */}
      {view === 'REPORT' && data && (
        <div id="resultArea">
          <div className="bg-[#f0f9f6] p-4 rounded-lg mb-6 border border-[#006a4e]/20 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-gray-500 block text-xs uppercase font-bold">{t('lblId', "ID")}</span><strong className="text-[#006a4e] text-base">{data.info?.id}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">{t('lblName', "Name")}</span><strong className="text-gray-800">{data.info?.name}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">{t('lblDesig', "Designation")}</span><strong className="text-gray-800">{data.info?.designation}</strong></div>
            <div><span className="text-gray-500 block text-xs uppercase font-bold">{t('lblDept', "Department")}</span><strong className="text-gray-800">{data.info?.department}</strong></div>
          </div>

          <div className="overflow-x-auto mb-8 border-2 border-gray-100 rounded-xl shadow-lg">
            <table className="w-full text-sm text-left text-gray-700 whitespace-nowrap">
              <thead className="text-xs text-white uppercase bg-[#006a4e] print:text-black print:bg-gray-200">
                <tr>
                  <th className="px-4 py-4">{t('colDate', "Date")}</th>
                  <th className="px-4 py-4">{t('colDay', "Day")}</th>
                  <th className="px-4 py-4">{t('colSchIn', "Sch In")}</th>
                  <th className="px-4 py-4">{t('colSchOut', "Sch Out")}</th>
                  <th className="px-4 py-4">{t('colIn', "In")}</th>
                  <th className="px-4 py-4">{t('colOut', "Out")}</th>
                  <th className="px-4 py-4">{t('colTotal', "Total")}</th>
                  <th className="px-4 py-3">{t('colStatus', "Status")}</th>
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
              {t('reviewSummaryTitle', "Review Summary:")} {data.info?.name} - {data.dateRange}
            </h3>
            
            <p className="text-sm text-[#006a4e] mb-6 font-bold leading-relaxed">
              {t('lblCommonWeekend', "Common Weekend =")} {sysConfig?.weekend || '...'} <br /> 
              {t('lblHoliday', "Holiday =")} {sysConfig?.holiday || '...'} <br />
              {t('lblCommonShift', "Common Shift =")} {sysConfig?.commonShift || '...'} <br />
              {t('lblSpecialShift', "Special Shift =")} {sysConfig?.specialShift || '...'}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
              {[
                { 
                  id: 'otDutyDays', 
                  label: `1. ${t('field1Label', 'Total Overtime Duty Days in')} ${targetMonthText}`, 
                  sub: `[${targetMonthText} ${t('field1Sub', 'মাসে মোট কয়দিন উনাকে ওভারটাইম ডিউটির অনুমতি দিয়েছিলেন?')}]`,
                  type: 'text',
                  placeholder: t('placeholderDays', 'e.g. 5')
                },
                { 
                  id: 'totalOtHours', 
                  label: `2. ${t('field2Label', 'Total Overtime Hours in')} ${targetMonthText}`, 
                  sub: `[${targetMonthText} ${t('field2Sub', 'মাসে উনার সর্বমোট ওভারটাইম কত ঘন্টা?')}]`,
                  type: 'text',
                  placeholder: t('placeholderHours', 'h:mm'),
                  useTimeBlur: true
                },
                { 
                  id: 'totalHolidayDays', 
                  label: `3. ${t('field3Label', 'Total Holiday/Weekend Duty Days in')} ${targetMonthText}`, 
                  sub: `[${targetMonthText} ${t('field3Sub', 'মাসে উনার মোট হলিডে বা উইকেন্ড ডিউটি কতদিন?')}]`,
                  type: 'text',
                  placeholder: t('placeholderDays', 'e.g. 3')
                },
                { 
                  id: 'totalHolidayHours', 
                  label: holidayHoursLabel, 
                  sub: holidayHoursSub,
                  type: 'text',
                  placeholder: t('placeholderHours', 'h:mm'),
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
               <h4 className="font-black text-red-700 mb-3 text-lg">{t('importantNoteTitle', "গুরুত্বপূর্ণ নোট:")}</h4>
               <ul className="list-decimal pl-6 space-y-2 font-semibold">
                <li>{t('importantNote1', "যেকোনো হলিডে বা ওভারটাইম ডিউটি বিলের ক্ষেত্রে উপস্থিতির পাঞ্চ বাধ্যতামূলক।")}</li>
                <li>{t('importantNote2', "সুপারভাইজারের রিকমেন্ডেশন অবশ্যই উক্ত এমপ্লয়ীর জন্য ম্যানেজমেন্ট প্রদত্ত অনুমোদনের সঙ্গে সামঞ্জস্যপূর্ণ হতে হবে।")}</li>
                <li>{t('importantNote3', "উপস্থিতির পাঞ্চ থাকলেও সুপারভাইজার এর রিকমেন্ডেশন ব্যতীত হলিডে বা ওভারটাইম ডিউটি বিল প্রদান করা হবে না।")}</li>
               </ul>
            </div>

            <label id="termsCheckboxLabel" className="flex items-center gap-4 mb-8 font-black cursor-pointer p-5 bg-white border-2 border-[#006a4e]/20 rounded-xl hover:bg-[#f0f9f6] no-print transition-colors">
              <input 
                type="checkbox" 
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="w-7 h-7 accent-[#006a4e]" 
              /> 
              <span className="text-gray-900 uppercase tracking-tighter">{t('termsText', "I have read and agreed to the above terms.")}</span>
            </label>

            <div id="supervisorInputSection" className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-2 border-gray-200 pt-8 no-print">
               <div>
                 <label className="block font-black text-gray-800 mb-2">{t('supIdLabel', "Supervisor ID")}</label>
                 <input 
                   type="text" 
                   id="supId"
                   value={form.supId}
                   onChange={handleInputChange}
                   className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-[#006a4e]/10 focus:border-[#006a4e] outline-none font-bold" 
                   placeholder={t('supIdPlaceholder', "Enter Your ID")} 
                 />
               </div>
               <div>
                 <label className="block font-black text-gray-800 mb-2">{t('supEmailLabel', "Supervisor Official Email")}</label>
                 <input 
                   type="email" 
                   value={email}
                   onChange={(e) => setEmail(e.target.value)}
                   className="w-full p-3 border-2 border-gray-200 rounded-lg focus:ring-4 focus:ring-[#006a4e]/10 focus:border-[#006a4e] outline-none font-bold" 
                   placeholder={t('supEmailPlaceholder', "supervisor@company.com")} 
                 />
               </div>
            </div>

            <div id="printSignatures" className="hidden justify-between mt-24 pt-12">
              <div className="text-center">
                <div className="w-56 border-t-2 border-black pt-2 font-black text-lg">{t('signEmp', "Signature of Employee")}</div>
              </div>
              <div className="text-left">
                <div className="w-72 border-t-2 border-black pt-2 font-black text-lg">{t('signSup', "Signature of Supervisor")}</div>
                <div className="mt-6 text-base font-bold">{t('signId', "ID:")} __________________________</div>
                <div className="mt-6 text-base font-bold">{t('signDate', "Date:")} ________________________</div>
              </div>
            </div>

            <div className="mt-12 text-center no-print">
               <p className="text-xl md:text-3xl font-black text-[#006a4e] mb-6 px-10 py-6 border-4 border-dashed border-[#006a4e] rounded-3xl inline-block bg-white shadow-2xl animate-pulse">
                {t('printPrompt1', "Please print the report before submit online.")} <br/>
                <span className="text-lg md:text-2xl font-bold">{t('printPrompt2', "[অনলাইনে রিপোর্টটি সাবমিট করার পূর্বে প্রিন্ট করে নিন]")}</span>
               </p>
            </div>

            <div className="mt-8 flex flex-col items-end gap-2 no-print">
              <p className="text-red-600 font-bold text-sm italic">
                {t('printWarning', "* একজন কর্মীর জন্য একাধিকবার এন্ট্রি করলে সর্বশেষ এন্ট্রি গণ্য হবে")}
              </p>
              <div className="flex flex-col sm:flex-row justify-end gap-6 w-full">
                <button 
                  id="printBtn"
                  type="button"
                  onClick={handlePrint} 
                  className="bg-gray-800 text-white px-10 py-4 rounded-xl hover:bg-black font-black text-lg shadow-xl transition transform hover:scale-105 flex items-center justify-center gap-3"
                >
                  {t('printBtn', "🖨️ Print Report")}
                </button>
                
                <button 
                  id="otpBtn"
                  type="button"
                  onClick={initiateOtp} 
                  disabled={otpLoading}
                  className="bg-[#16a34a] text-white px-12 py-4 rounded-xl hover:bg-[#11803a] font-black text-lg shadow-xl transition transform hover:scale-105 disabled:opacity-50"
                >
                  {otpLoading ? t('otpBtnLoading', "Sending Code...") : t('otpBtn', "Request OTP & Submit")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* SUCCESS STATE */}
      {view === 'SUCCESS' && (
        <div id="successPage" className="text-center py-20">
          <div className="checkmark-circle"><span className="checkmark">✔</span></div>
          <h2 className="text-4xl font-black text-gray-900 mb-4 uppercase tracking-widest">{t('successTitle', "Success!")}</h2>
          <p className="text-gray-700 text-xl mb-12 font-bold">{t('successMsg', "Your submission has been recorded successfully.")}</p>
          <button 
            type="button"
            onClick={() => window.location.reload()} 
            className="bg-[#006a4e] text-white px-10 py-4 rounded-xl hover:bg-[#00523c] font-black text-lg shadow-xl transition transform hover:scale-105"
          >
            {t('reviewAnotherBtn', "Review Another Employee")}
          </button>
        </div>
      )}

      {/* OTP MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 backdrop-blur-md no-print p-4">
          <div className="bg-white p-10 rounded-3xl text-center w-full max-w-md shadow-[0_35px_60px_-15px_rgba(0,0,0,0.3)] border-t-8 border-[#006a4e]">
            <h3 className="text-3xl font-black mb-4 text-gray-900">{t('otpModalTitle', "VERIFY ACCESS")}</h3>
            <p className="text-base text-gray-600 mb-8 font-bold italic">{t('otpModalDesc', "Check your official email for the 6-digit code.")}</p>
            
            <input 
              type="text" 
              value={otpInput}
              onChange={(e) => setOtpInput(e.target.value)}
              className="text-center text-5xl mb-8 font-black border-b-4 border-[#006a4e] focus:border-green-500 w-full py-3 tracking-[0.6em] outline-none text-[#006a4e]" 
              maxLength={6} 
              placeholder="000000" 
            />
            
            <div className={`text-2xl font-black mb-10 p-3 rounded-lg inline-block px-8 ${timer > 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
              {timer > 0 ? formatTime(timer) : t('expiredText', "EXPIRED")}
            </div>
            
            <div className="flex gap-4">
              <button 
                type="button"
                onClick={() => setShowOtpModal(false)} 
                className="flex-1 py-4 bg-gray-100 text-gray-800 rounded-xl hover:bg-gray-200 font-black uppercase"
              >
                {t('backBtn', "Back")}
              </button>
              <button 
                type="button"
                onClick={verifyOtp} 
                disabled={timer === 0 || verifyLoading}
                className="flex-[2] py-4 bg-[#16a34a] text-white rounded-xl hover:bg-[#11803a] font-black shadow-lg disabled:opacity-50 uppercase tracking-widest"
              >
                {verifyLoading ? t('confirmBtnLoading', "Verifying...") : t('confirmBtn', "Confirm Code")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
