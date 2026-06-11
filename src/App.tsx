import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import html2canvas from 'html2canvas';
import { 
  PenTool, 
  User, 
  GraduationCap, 
  Calendar, 
  BookOpen, 
  Upload, 
  Send, 
  ArrowLeft, 
  Printer, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Trophy,
  Activity,
  FileText,
  Target,
  ShieldCheck,
  Languages,
  GitMerge,
  SpellCheck,
  Settings,
  Key,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';
import { gradeEssay, GradingResult, EssayError } from './services/geminiService.ts';
import { logoBase64 } from './logoBase64';

// --- Types ---
interface StudentInfo {
  center: string;
  teacher: string;
  name: string;
  class: string;
  date: string;
  level: string;
  topic: string;
}

// --- Components ---

const GradePill = ({ score }: { score: number }) => {
  let color = 'bg-red-100 text-red-700 border-red-200';
  let label = 'Chưa đạt'; // Below 5.0
  
  if (score >= 9.0) {
    color = 'bg-emerald-100 text-emerald-700 border-emerald-200';
    label = 'Giỏi (Excellent)';
  } else if (score >= 7.5) {
    color = 'bg-blue-100 text-blue-700 border-blue-200';
    label = 'Khá (Good)';
  } else if (score >= 5.0) {
    color = 'bg-amber-100 text-amber-700 border-amber-200';
    label = 'Trung bình (Average)';
  }

  return (
    <span className={`px-3 py-1 rounded-full text-xs uppercase font-bold border tracking-wider ${color}`}>
      {label}
    </span>
  );
};

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
  <div className="flex items-center gap-2 mb-4 mt-6 first:mt-0">
    <div className="p-1.5 rounded-lg bg-brand-red/10 text-brand-red">
      <Icon size={16} />
    </div>
    <h3 className="text-xs font-black uppercase tracking-widest text-slate-700 flex-1 flex items-center gap-3">
      {title}
      <div className="h-px bg-slate-300 flex-1" />
    </h3>
  </div>
);

const EssayCorrector = ({ essay, errors }: { essay: string, errors: EssayError[] }) => {
  if (!errors || errors.length === 0) {
    return <p className="text-slate-700 leading-relaxed font-medium">{essay}</p>;
  }

  // Sort errors by length descending to avoid replacing sub-strings of other errors first
  const sortedErrors = [...errors].sort((a, b) => b.original.length - a.original.length);
  
  let content: (string | React.ReactNode)[] = [essay];

  sortedErrors.forEach((err, errIdx) => {
    const newContent: (string | React.ReactNode)[] = [];
    
    content.forEach((segment) => {
      if (typeof segment !== 'string') {
        newContent.push(segment);
        return;
      }

      const parts = segment.split(err.original);
      if (parts.length === 1) {
        newContent.push(segment);
      } else {
        parts.forEach((part, i) => {
          newContent.push(part);
          if (i < parts.length - 1) {
            newContent.push(
              <span key={`${errIdx}-${i}`} className="relative group/err inline-block cursor-help">
                <del className="text-red-500 bg-red-50 px-1 rounded-sm decoration-red-500/50 decoration-2 transition-colors">
                  {err.original}
                </del>
                <ins className="no-underline text-emerald-600 font-bold ml-1">
                  {err.correction}
                </ins>
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl opacity-0 invisible group-hover/err:opacity-100 group-hover/err:visible transition-all z-20 pointer-events-none text-center leading-tight font-medium">
                  {err.explanation}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800" />
                </div>
              </span>
            );
          }
        });
      }
    });
    content = newContent;
  });

  return (
    <div className="text-slate-800 leading-loose font-medium space-y-4">
      {content}
    </div>
  );
};

const ScoreBox = ({ label, score, max = 2.0 }: { label: string, score: number, max?: number }) => (
  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
    <div className="text-xs text-slate-700 font-black mb-1 uppercase tracking-wider">{label}</div>
    <div className="flex items-baseline justify-center gap-0.5">
      <span className="text-2xl font-serif font-black text-slate-900">{score.toFixed(1)}</span>
      <span className="text-xs text-slate-500 font-bold">/{max.toFixed(1)}</span>
    </div>
  </div>
);

export default function App() {
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [essay, setEssay] = useState('');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('GEMINI_API_KEY') || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [tempKey, setTempKey] = useState('');
  
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!apiKey) {
      setShowKeyModal(true);
    }
  }, []);

  const handleSaveKey = (key: string) => {
    const trimmed = key.trim();
    if (trimmed) {
      localStorage.setItem('GEMINI_API_KEY', trimmed);
      setApiKey(trimmed);
      setShowKeyModal(false);
    }
  };
  const [studentInfo, setStudentInfo] = useState<StudentInfo>({
    center: 'ENGLISH MS TRANG',
    teacher: 'Ms. Trang',
    name: '',
    class: '',
    date: new Date().toLocaleDateString('vi-VN'),
    level: 'A2',
    topic: ''
  });

  const handleGrade = async () => {
    if (!apiKey) {
      setShowKeyModal(true);
      return;
    }
    if (!studentInfo.topic.trim()) {
      setError("Vui lòng nhập Đề bài / Topic trước khi chấm.");
      return;
    }
    if (!essay.trim()) {
      setError("Vui lòng nhập bài viết của học sinh.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await gradeEssay(essay, studentInfo.level, apiKey, studentInfo.topic);
      setResult(res);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setError(err.message || "Đã có lỗi xảy ra khi chấm bài.");
    } finally {
      setLoading(false);
    }
  };

  const exportImage = async () => {
    if (resultRef.current === null) return;
    
    setExporting(true);
    try {
      // Small delay to ensure all animations settled
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const canvas = await html2canvas(resultRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        allowTaint: false,
        scrollX: 0,
        scrollY: 0,
        logging: true,
        width: resultRef.current.offsetWidth,
        height: resultRef.current.offsetHeight
      });
      
      canvas.toBlob((blob) => {
        if (!blob) {
          throw new Error('Canvas to Blob failed');
        }
        const dataUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const safeName = (studentInfo.name || 'HocSinh').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `PhieuCham_${safeName}.png`;
        link.href = dataUrl;
        link.click();
        
        // Cleanup
        setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
      }, 'image/png');
    } catch (err) {
      console.error('Export failed', err);
      alert('Không thể xuất ảnh. Vui lòng thử lại.');
    } finally {
      setExporting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setEssay('');
    setError(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-6 text-brand-red"
        >
          <Activity size={48} />
        </motion.div>
        <h2 className="text-2xl font-serif font-bold text-slate-900 mb-2 animate-pulse">WriteScore AI đang phân tích...</h2>
        <p className="text-slate-500 max-w-sm">
          Đang đánh giá 5 tiêu chí CEFR, trình độ thực tế và gợi ý lộ trình nâng cao trình độ cho học sinh.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 md:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <header className="bg-brand-red rounded-2xl p-8 mb-8 relative overflow-hidden shadow-xl shadow-brand-red/20 print:hidden text-center md:text-left border-b-4 border-brand-gold">
          <div className="absolute top-0 right-0 w-64 h-64 bg-red-400 opacity-10 rounded-full -mr-20 -mt-20" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-gold opacity-10 rounded-full -ml-16 -mb-16" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-20 h-20 md:w-28 md:h-28 bg-white rounded-full border-4 border-brand-gold p-1 shadow-2xl flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-white/10">
                   <img src={logoBase64} alt="Logo English Ms Trang" className="w-full h-full object-contain" onError={(e) => {
                     e.currentTarget.src = "https://ui-avatars.com/api/?name=English+Ms+Trang&background=8d141e&color=ffffff";
                   }}/>
                </div>
                <div className="text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2 group">
                     <div className="p-1.5 bg-brand-gold rounded-lg shadow-xl shadow-brand-gold/30">
                        <PenTool size={16} className="text-brand-red" />
                     </div>
                     <span className="text-[10px] font-black text-brand-gold uppercase tracking-[0.3em] whitespace-nowrap drop-shadow-md">WriteScore AI System</span>
                  </div>
                  <h1 className="text-2xl md:text-4xl font-serif font-black text-white tracking-tight drop-shadow-2xl whitespace-nowrap">
                    English Ms Trang
                  </h1>
                </div>
              </div>
              
              <button 
                onClick={() => {
                  setTempKey(apiKey);
                  setShowKeyModal(true);
                }}
                className={`p-3 rounded-xl transition-all flex flex-col items-center gap-1 group shadow-lg border-2 ${!apiKey ? 'bg-red-500/20 border-red-500/50 hover:bg-red-500/30 animate-pulse' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
              >
                <div className="flex items-center gap-2">
                  <Settings size={20} className={`text-white group-hover:rotate-90 transition-transform duration-500 ${!apiKey ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
                  <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block text-white">Settings (API Key)</span>
                </div>
                {!apiKey ? (
                  <span className="text-[8px] font-black text-red-400 whitespace-nowrap">Lấy API key để sử dụng app</span>
                ) : (
                  <span className="text-[8px] font-bold text-emerald-400 whitespace-nowrap">API Key đã sẵn sàng</span>
                )}
              </button>
            </div>
            
            <p className="text-white font-serif text-base md:text-lg font-black drop-shadow-sm opacity-90">
              "Xây nền từ móng, chinh phục đỉnh cao"
            </p>
          </div>
        </header>

        {/* API Key Modal */}
        <AnimatePresence>
          {showKeyModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => apiKey && setShowKeyModal(false)}
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
              />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-md bg-white rounded-3xl p-8 shadow-2xl border border-slate-200"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-brand-red rounded-2xl text-white">
                    <Key size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-serif font-black text-slate-900">Cấu hình Gemini API Key</h2>
                    <p className="text-sm text-slate-500 font-medium tracking-tight whitespace-nowrap">Để bảo mật, API key được lưu trên trình duyệt của bạn.</p>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Nhập API Key của bạn</label>
                    <input 
                      type="password"
                      placeholder="AIzaSy..."
                      className="w-full h-14 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red outline-none text-base font-bold text-slate-900 shadow-sm"
                      value={tempKey}
                      onChange={(e) => setTempKey(e.target.value)}
                    />
                  </div>

                  <a 
                    href="https://aistudio.google.com/api-keys" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-3 px-4 bg-slate-50 hover:bg-slate-100 rounded-2xl text-xs font-bold text-slate-600 transition-colors border border-slate-100 group"
                  >
                    <ExternalLink size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    Chưa có Key? Lấy API Key tại Google AI Studio
                  </a>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => handleSaveKey(tempKey)}
                      className="w-full h-14 bg-brand-red text-white font-black rounded-2xl shadow-xl shadow-brand-red/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      Lưu và tiếp tục
                    </button>
                    {apiKey && (
                      <button 
                        onClick={() => setShowKeyModal(false)}
                        className="w-full py-2 text-slate-400 font-bold text-xs hover:text-slate-600 transition-colors"
                      >
                        Đóng lại
                      </button>
                    )}
                  </div>
                  
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl">
                    <p className="text-[10px] leading-relaxed text-red-800 font-medium">
                      * Lưu ý: Hãy giữ bí mật API key của bạn. WriteScore không lưu trữ key này trên máy chủ của chúng tôi.
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div 
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
            >
              {/* Teacher Info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={User} title="Thông tin trung tâm / Giáo viên" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <User size={14} className="text-brand-red" />
                      Trung tâm / Trường
                    </label>
                    <input 
                      type="text" 
                      placeholder="ENGLISH MS TRANG"
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red focus:ring-4 focus:ring-brand-red/10 outline-none transition-all text-base font-black text-brand-red shadow-sm"
                      value={studentInfo.center}
                      onChange={e => setStudentInfo({ ...studentInfo, center: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
                      <User size={14} className="text-brand-red" />
                      Giáo viên phụ trách
                    </label>
                    <input 
                      type="text" 
                      placeholder="Ms. Trang"
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red focus:ring-4 focus:ring-brand-red/10 outline-none transition-all text-base font-black text-brand-red shadow-sm"
                      value={studentInfo.teacher}
                      onChange={e => setStudentInfo({ ...studentInfo, teacher: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Student Info */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={GraduationCap} title="Thông tin học sinh" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-1">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Họ và tên học sinh</label>
                    <input 
                      type="text" 
                      placeholder="Nguyễn Văn A"
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red focus:ring-4 focus:ring-brand-red/10 outline-none transition-all text-base font-bold text-slate-900 shadow-sm"
                      value={studentInfo.name}
                      onChange={e => setStudentInfo({ ...studentInfo, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Lớp / Nhóm</label>
                    <input 
                      type="text" 
                      placeholder="8A"
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red focus:ring-4 focus:ring-brand-red/10 outline-none transition-all text-base font-bold text-slate-900 shadow-sm"
                      value={studentInfo.class}
                      onChange={e => setStudentInfo({ ...studentInfo, class: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Ngày chấm bài</label>
                    <div className="relative">
                      <input 
                        type="text" 
                        readOnly
                        className="w-full h-12 px-5 rounded-2xl border-2 border-slate-100 bg-slate-50 text-base font-bold text-slate-600 cursor-not-allowed"
                        value={studentInfo.date}
                      />
                      <Calendar size={16} className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-400" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Level & Topic */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <SectionHeader icon={BookOpen} title="Trình độ & Đề bài" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest">Trình độ đăng ký (CEFR)</label>
                    <select 
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red outline-none text-base font-bold text-slate-900 appearance-none bg-white cursor-pointer shadow-sm"
                      value={studentInfo.level}
                      onChange={e => setStudentInfo({ ...studentInfo, level: e.target.value })}
                    >
                      <optgroup label="Young Learners (YLE)">
                        <option value="Starters">Starters (Beginner)</option>
                        <option value="Movers">Movers (A1)</option>
                        <option value="Flyers">Flyers (A2)</option>
                      </optgroup>
                      <optgroup label="CEFR Standard">
                        <option value="A1">A1 — Elementary</option>
                        <option value="A2">A2 — Pre-Intermediate</option>
                        <option value="B1">B1 — Intermediate</option>
                        <option value="B2">B2 — Upper-Intermediate</option>
                        <option value="C1">C1 — Advanced</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-1">
                      Đề bài / Topic <span className="text-red-500 font-bold">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="VD: Viết về sở thích cá nhân..."
                      className="w-full h-12 px-5 rounded-2xl border-2 border-slate-200 focus:border-brand-red outline-none text-base font-medium text-slate-900 shadow-sm"
                      value={studentInfo.topic}
                      onChange={e => setStudentInfo({ ...studentInfo, topic: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Writing Area */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                   <SectionHeader icon={PenTool} title="Bài viết của học sinh" />
                   <button className="text-[10px] uppercase font-bold text-brand-red flex items-center gap-1 hover:opacity-70">
                     <Upload size={14} /> Tải ảnh lên
                   </button>
                </div>
                <textarea 
                  placeholder="Học sinh gõ hoặc dán bài viết vào đây..."
                  className="w-full min-h-[350px] p-8 rounded-3xl border-2 border-slate-200 focus:border-brand-red focus:ring-8 focus:ring-brand-red/5 outline-none transition-all text-lg leading-relaxed resize-none font-medium text-slate-800 shadow-inner"
                  value={essay}
                  onChange={e => setEssay(e.target.value)}
                />
                
                {error && (
                  <div className="mt-4 p-3 rounded-lg bg-red-50 text-red-600 text-xs flex items-center gap-2 border border-red-100 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
              </div>

              <button 
                onClick={handleGrade}
                className="w-full h-16 bg-brand-red hover:bg-brand-red-dark text-white font-black text-lg uppercase tracking-widest rounded-3xl shadow-2xl shadow-brand-red/40 flex items-center justify-center gap-3 transition-all group active:scale-[0.98]"
              >
                <div className="bg-white/20 p-2 rounded-xl">
                  <Send size={20} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
                Chấm bài ngay
              </button>
            </motion.div>
          ) : (
            <motion.div 
              key="result"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              <div className="flex justify-between items-center print:hidden px-4">
                 <button 
                  onClick={reset}
                  className="text-slate-500 font-bold text-sm flex items-center gap-2 hover:text-brand-red transition-colors"
                >
                  <ArrowLeft size={16} /> Chấm bài mới
                </button>
                <div className="flex gap-2">
                   <button 
                    onClick={exportImage}
                    disabled={exporting}
                    className="h-10 px-4 bg-slate-100 text-slate-600 font-bold rounded-lg flex items-center gap-2 text-xs hover:bg-slate-200 disabled:opacity-50"
                  >
                    {exporting ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />} 
                    Lưu hình ảnh
                  </button>
                  <button 
                    onClick={() => window.print()}
                    className="h-10 px-4 bg-brand-red text-white font-bold rounded-lg flex items-center gap-2 text-xs shadow-sm"
                  >
                    <Printer size={14} /> In kết quả
                  </button>
                </div>
              </div>

              {/* Result Summary */}
              <div ref={resultRef} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xl">
                <div className="bg-brand-red p-6 md:p-8 text-white relative border-b-4 border-brand-gold">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -mr-24 -mt-24 border border-white/10" />
                  <div className="absolute bottom-0 left-0 w-32 h-32 bg-brand-gold/5 rounded-full -ml-16 -mb-16" />
                  
                  <div className="relative z-10 flex flex-col md:flex-row justify-between items-center md:items-center gap-6">
                    <div className="text-center md:text-left flex flex-col items-center md:items-start text-white">
                      <div className="w-14 h-14 bg-white rounded-full p-1 border-2 border-brand-gold shadow-xl mb-2 flex items-center justify-center overflow-hidden">
                        <img src={logoBase64} alt="Logo Result" className="w-full h-full object-contain" />
                      </div>
                      <h2 className="text-xl md:text-2xl font-serif font-black mb-1 text-brand-gold uppercase tracking-tight drop-shadow-lg">{studentInfo.name || "Học sinh"}</h2>
                      <div className="space-y-1.5 text-xs text-white">
                        <div className="flex items-center justify-center md:justify-start gap-2">
                           <GraduationCap size={14} className="text-brand-gold shrink-0" />
                           <div className="flex items-center gap-1.5">
                             <span className="uppercase tracking-widest text-[8px] font-black opacity-90 text-brand-gold/90 decoration-brand-gold underline decoration-1 underline-offset-2">Center:</span>
                             <span className="font-bold">{studentInfo.center || "English Ms Trang"}</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2">
                           <BookOpen size={14} className="text-brand-gold shrink-0" />
                           <div className="flex items-center gap-1.5">
                             <span className="uppercase tracking-widest text-[8px] font-black opacity-90 text-brand-gold/90 decoration-brand-gold underline decoration-1 underline-offset-2">Topic:</span>
                             <span className="font-bold line-clamp-1 truncate max-w-[200px]">{studentInfo.topic || "General Writing"}</span>
                           </div>
                        </div>
                        <div className="flex items-center justify-center md:justify-start gap-2">
                           <Calendar size={14} className="text-brand-gold shrink-0" />
                           <div className="flex items-center gap-1.5">
                             <span className="uppercase tracking-widest text-[8px] font-black opacity-90 text-brand-gold/90 decoration-brand-gold underline decoration-1 underline-offset-2">Date:</span>
                             <span className="font-bold">{studentInfo.date}</span>
                           </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center md:text-right bg-black/20 p-4 rounded-xl border border-white/10 backdrop-blur-xl shadow-inner min-w-[130px]">
                      <div className="text-[8px] font-black text-brand-gold uppercase tracking-[0.3em] mb-1 drop-shadow-sm">Final Score</div>
                      <div className="flex items-baseline justify-center md:justify-end gap-1 mb-1">
                        <span className="text-4xl md:text-5xl font-serif font-black text-white leading-none drop-shadow-2xl">{result.total.toFixed(1)}</span>
                        <span className="text-base text-white/30 font-serif font-bold">/10</span>
                      </div>
                      <div className="scale-75 origin-center md:origin-right transform">
                        <GradePill score={result.total} />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-8 md:p-10">
                  {/* CEFR Level Box */}
                  <div className="bg-brand-gold-light border-2 border-brand-gold/20 rounded-3xl p-6 md:p-8 mb-10 relative overflow-hidden group hover:border-brand-gold/40 transition-colors">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                       <CheckCircle2 size={120} />
                    </div>
                    <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                      <div className="w-16 h-16 shrink-0 rounded-xl bg-white border-4 border-brand-gold flex items-center justify-center text-lg sm:text-xl font-serif font-black text-brand-red shadow-lg">
                        {result.demonstrated_cefr}
                      </div>
                      <div className="text-center md:text-left">
                        <div className="text-xs font-bold text-brand-red uppercase tracking-[0.2em] mb-2">Trình độ thực tế (Practical Assessment)</div>
                        <p className="text-lg text-brand-red-dark leading-relaxed font-serif italic font-medium">
                          "{result.cefr_comment}"
                        </p>
                      </div>
                    </div>
                  </div>

                  <SectionHeader icon={Trophy} title="Điểm thành phần (Chuẩn CEFR)" />
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-8">
                    <ScoreBox label="Nhiệm vụ" score={result.task_achievement.score} />
                    <ScoreBox label="Ngữ pháp" score={result.grammar.score} />
                    <ScoreBox label="Từ vựng" score={result.vocabulary.score} />
                    <ScoreBox label="Mạch lạc" score={result.coherence.score} />
                    <ScoreBox label="Chính tả" score={result.spelling.score} />
                  </div>

                  <SectionHeader icon={ShieldCheck} title="Phân tích bài viết & Sửa lỗi (Essay Correction)" />
                  <div className="bg-slate-50 border-2 border-slate-200 rounded-3xl p-6 md:p-8 mb-10 shadow-inner">
                    <div className="flex items-center gap-2 mb-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <AlertCircle size={14} className="text-red-400" /> 
                       Di chuột vào chữ màu đỏ để xem giải thích lỗi sai
                    </div>
                    <EssayCorrector essay={essay} errors={result.identified_errors || []} />
                  </div>

                  <SectionHeader icon={CheckCircle2} title="Nhận xét chi tiết (Detailed Analytics)" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                    {[
                      { l: 'Task Achievement', f: result.task_achievement.feedback, s: result.task_achievement.score, icon: Target },
                      { l: 'Grammar', f: result.grammar.feedback, s: result.grammar.score, icon: ShieldCheck },
                      { l: 'Vocabulary', f: result.vocabulary.feedback, s: result.vocabulary.score, icon: Languages },
                      { l: 'Coherence', f: result.coherence.feedback, s: result.coherence.score, icon: GitMerge },
                      { l: 'Spelling', f: result.spelling.feedback, s: result.spelling.score, icon: SpellCheck },
                    ].map((item, idx) => (
                      <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border-t-4 border-t-brand-red group">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2.5">
                             <item.icon size={18} className="text-brand-red group-hover:scale-110 transition-transform" />
                             <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{item.l}</h4>
                          </div>
                          <div className="bg-brand-red/10 px-3 py-1 rounded-full">
                             <span className="text-sm font-serif font-bold text-brand-red">{item.s.toFixed(1)}<span className="opacity-40 text-xs">/2.0</span></span>
                          </div>
                        </div>
                        <p className="text-sm text-slate-800 leading-relaxed font-normal">{item.f}</p>
                      </div>
                    ))}
                  </div>

                  <SectionHeader icon={Activity} title="Lộ trình nâng cao trình độ" />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-3">Kỹ năng cần luyện tập</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.skills_to_practise.map((s, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">{s}</span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-5">
                      <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-widest mb-3">Chủ đề nên bổ trợ</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.topics_to_study.map((t, idx) => (
                          <span key={idx} className="px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs text-indigo-900 font-medium">{t}</span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <SectionHeader icon={FileText} title="Bài viết mẫu gợi ý (Model Essay)" />
                  <div className="bg-brand-red rounded-3xl p-8 md:p-10 text-white relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                       <FileText size={80} />
                    </div>
                    <div className="relative z-10">
                      <div className="inline-block px-3 py-1 bg-brand-gold text-brand-red text-xs font-bold rounded-full uppercase tracking-widest mb-6">High Quality Sample</div>
                      <div className="text-base md:text-lg leading-relaxed font-serif italic text-white/90 font-medium">
                        {result.improved_essay.split('\n').map((line, i) => (
                          <React.Fragment key={i}>
                            {line}
                            <br />
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-8 border-t border-slate-100 text-center text-[10px] text-slate-400 uppercase tracking-[0.2em]">
                    WriteScore AI · Powered by Gemini · CEFR Standard
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-16 bg-brand-red rounded-3xl p-6 md:p-8 text-white shadow-2xl relative overflow-hidden print:hidden border-t-8 border-brand-gold">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-gold opacity-5 rounded-full -mr-32 -mt-32" />
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-10">
            {/* Brand */}
            <div className="text-center md:text-left">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white rounded-full p-1 mb-4 mx-auto md:mx-0 flex items-center justify-center overflow-hidden border-2 border-brand-gold shadow-2xl ring-4 ring-white/5">
                 <img src={logoBase64} alt="Logo Footer" className="w-full h-full object-contain" />
              </div>
              <h2 className="text-lg font-serif font-black text-brand-gold mb-1 uppercase tracking-wide drop-shadow-md whitespace-nowrap">English Ms Trang</h2>
              <p className="text-xs text-white font-black mb-1 slide-in-from-left opacity-90 drop-shadow-sm italic">"Xây nền từ móng, chinh phục đỉnh cao"</p>
              <p className="text-[10px] text-white/80 leading-relaxed font-medium mt-2">
                Pallas – nơi tri thức được trao truyền, ước mơ được nuôi dưỡng và những thế hệ học sinh được chắp cánh vươn xa.
              </p>
            </div>

            {/* Contact */}
            <div className="md:col-span-2">
              <h3 className="text-xs font-black text-brand-gold uppercase tracking-[0.2em] mb-4 border-b-2 border-white/10 pb-2">Liên hệ với chúng tôi</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 text-left">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/10 rounded-lg text-brand-gold mt-1 shadow-md">
                    <Activity size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">Địa chỉ</div>
                    <p className="text-xs text-white font-bold leading-tight">
                      CS1: SN 31 ngõ 77 Nguyễn Trãi, Phường Kinh Môn, TP Hải Phòng.
                      <br />
                      CS2: SN 347 Đường Vũ Mạnh Hùng, Phường Nhị Chiểu, TP Hải Phòng.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/10 rounded-lg text-brand-gold mt-1 shadow-md">
                    <User size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">Hotline</div>
                    <p className="text-sm text-white font-bold">Ms. Trang: 0979.2222.10</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 overflow-hidden">
                  <div className="p-2 bg-white/10 rounded-lg text-brand-gold mt-1 shadow-md shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">Email</div>
                    <p className="text-sm text-white font-bold break-words leading-tight">englishmstrang@gmail.com</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="p-2 bg-white/10 rounded-lg text-brand-gold mt-1 shadow-md">
                    <Send size={14} />
                  </div>
                  <div>
                    <div className="text-[9px] text-white/50 uppercase font-black tracking-widest mb-0.5">Fanpage</div>
                    <a href="https://www.facebook.com/profile.php?id=61572690107644" target="_blank" rel="noopener noreferrer" className="text-sm text-white font-bold hover:text-brand-gold underline decoration-brand-gold/50 underline-offset-4">Fanpage Facebook</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-4 border-t border-white/10 text-center">
             <p className="text-[9px] text-white/30 uppercase tracking-[0.3em] font-medium">
               © {new Date().getFullYear()} English Ms Trang · Cambridge Standard Proficiency
             </p>
          </div>
        </footer>
      </div>
    </div>
  );
}
