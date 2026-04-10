import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Camera, 
  BookOpen, 
  History, 
  Plus, 
  Trash2, 
  Printer, 
  ChevronRight, 
  Loader2, 
  CheckCircle2,
  AlertCircle,
  FileText,
  RefreshCw,
  Download
} from 'lucide-react';
import { cn } from './lib/utils';
import { Question, Variation, OCRResult } from './types';
import { analyzeQuestionImage, generateVariations } from './lib/gemini';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export default function App() {
  const [activeTab, setActiveTab] = useState<'recognition' | 'history'>('recognition');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentOCR, setCurrentOCR] = useState<OCRResult | null>(null);
  const [currentVariations, setCurrentVariations] = useState<Variation[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wrong_questions');
    if (saved) {
      try {
        setQuestions(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse saved questions', e);
      }
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wrong_questions', JSON.stringify(questions));
    } catch (e) {
      console.error('Failed to save to localStorage', e);
      if (e instanceof Error && e.name === 'QuotaExceededError') {
        alert('存储空间已满，请删除部分历史记录后再试。');
      }
    }
  }, [questions]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      setSelectedImage(base64);
      setIsAnalyzing(true);
      setCurrentOCR(null);
      setCurrentVariations([]);
      
      try {
        const result = await analyzeQuestionImage(base64);
        setCurrentOCR(result);
      } catch (error) {
        console.error('Analysis failed', error);
        alert('识别失败，请重试');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateVariations = async () => {
    if (!currentOCR) return;
    setIsGenerating(true);
    try {
      const vars = await generateVariations(currentOCR.text, currentOCR.knowledgePoint);
      setCurrentVariations(vars);
    } catch (error) {
      console.error('Generation failed', error);
      alert('生成变式失败，请重试');
    } finally {
      setIsGenerating(false);
    }
  };

  const saveToHistory = () => {
    try {
      if (!currentOCR || currentVariations.length === 0) {
        alert('请先生成举一反三题目后再保存');
        return;
      }
      
      const newQuestion: Question = {
        id: Date.now().toString(),
        originalImage: selectedImage || undefined,
        originalText: currentOCR.text || '',
        options: currentOCR.options || [],
        userAnswer: currentOCR.userAnswer || '',
        correctAnswer: currentOCR.correctAnswer || '',
        knowledgePoint: currentOCR.knowledgePoint || '未分类',
        variations: currentVariations,
        createdAt: Date.now(),
      };

      setQuestions(prev => [newQuestion, ...prev]);
      setActiveTab('history');
      
      // Reset state
      setSelectedImage(null);
      setCurrentOCR(null);
      setCurrentVariations([]);
    } catch (error) {
      console.error('Save to history failed', error);
      alert('保存失败，可能是由于图片过大导致存储空间不足。');
    }
  };

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
    setSelectedIds(selectedIds.filter(sid => sid !== id));
  };

  const toggleSelect = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(sid => sid !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const handlePrint = async () => {
    if (selectedIds.length === 0) return;
    setIsPrinting(true);
    
    // Wait for DOM to render the print content
    setTimeout(async () => {
      const element = printRef.current;
      if (!element) return;

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
          logging: false,
        });
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`错题本_${new Date().toLocaleDateString()}.pdf`);
      } catch (error) {
        console.error('PDF generation failed', error);
      } finally {
        setIsPrinting(false);
      }
    }, 500);
  };

  return (
    <div className="min-h-screen flex flex-col max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-slate-100 px-6 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white">
              <BookOpen size={18} />
            </div>
            错题举一反三
          </h1>
          {activeTab === 'history' && questions.length > 0 && (
            <button 
              onClick={handlePrint}
              disabled={selectedIds.length === 0 || isPrinting}
              className="flex items-center gap-1.5 text-sm font-medium text-brand-600 disabled:opacity-50"
            >
              {isPrinting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              打印所选 ({selectedIds.length})
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        <AnimatePresence mode="wait">
          {activeTab === 'recognition' ? (
            <motion.div 
              key="recognition"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="p-6 space-y-6"
            >
              {/* Upload Area */}
              {!selectedImage ? (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="aspect-square border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-4 cursor-pointer hover:border-brand-400 hover:bg-brand-50 transition-all group"
                >
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center group-hover:bg-brand-100 transition-colors">
                    <Camera className="text-slate-400 group-hover:text-brand-500" size={32} />
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-slate-700">点击拍照或上传错题</p>
                    <p className="text-xs text-slate-400 mt-1">支持中文、英文、数学公式识别</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
                    <img src={selectedImage} alt="Selected" className="w-full h-auto max-h-64 object-contain bg-slate-50" />
                    <button 
                      onClick={() => {
                        setSelectedImage(null);
                        setCurrentOCR(null);
                        setCurrentVariations([]);
                      }}
                      className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full backdrop-blur-sm hover:bg-black/70 transition-colors"
                    >
                      <Plus className="rotate-45" size={20} />
                    </button>
                  </div>

                  {/* Recognition Result */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <FileText size={18} className="text-brand-500" />
                        识别结果
                      </h3>
                      {isAnalyzing && (
                        <div className="flex items-center gap-2 text-xs text-brand-500 font-medium">
                          <Loader2 size={14} className="animate-spin" />
                          AI 正在识别中...
                        </div>
                      )}
                    </div>

                    {currentOCR ? (
                      <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 space-y-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">题目内容</label>
                          <textarea 
                            value={currentOCR.text}
                            onChange={(e) => setCurrentOCR({...currentOCR, text: e.target.value})}
                            className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700 resize-none min-h-[80px]"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">知识点</label>
                            <input 
                              value={currentOCR.knowledgePoint}
                              onChange={(e) => setCurrentOCR({...currentOCR, knowledgePoint: e.target.value})}
                              className="w-full bg-transparent border-none focus:ring-0 text-sm font-medium text-brand-600"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">标准答案</label>
                            <input 
                              value={currentOCR.correctAnswer || ''}
                              onChange={(e) => setCurrentOCR({...currentOCR, correctAnswer: e.target.value})}
                              className="w-full bg-transparent border-none focus:ring-0 text-sm text-slate-700"
                              placeholder="选填"
                            />
                          </div>
                        </div>

                        {!currentVariations.length && (
                          <button 
                            onClick={handleGenerateVariations}
                            disabled={isGenerating}
                            className="w-full py-3 bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors disabled:opacity-50"
                          >
                            {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                            生成举一反三
                          </button>
                        )}
                      </div>
                    ) : !isAnalyzing && (
                      <div className="text-center py-8 text-slate-400 text-sm">
                        上传图片后自动识别题目
                      </div>
                    )}
                  </div>

                  {/* Variations */}
                  {currentVariations.length > 0 && (
                    <div className="space-y-4">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <CheckCircle2 size={18} className="text-green-500" />
                        举一反三变式题
                      </h3>
                      <div className="space-y-4">
                        {currentVariations.map((v, idx) => (
                          <div key={v.id} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-400">变式 {idx + 1}</span>
                            </div>
                            <p className="text-sm text-slate-700 leading-relaxed">{v.text}</p>
                            <div className="pt-3 border-t border-slate-50">
                              <p className="text-xs font-bold text-slate-400 mb-1">答案</p>
                              <p className="text-sm font-medium text-green-600">{v.answer}</p>
                            </div>
                            <div className="p-3 bg-brand-50 rounded-xl">
                              <p className="text-xs font-bold text-brand-700 mb-1 flex items-center gap-1">
                                <AlertCircle size={12} />
                                易错点分析
                              </p>
                              <p className="text-xs text-brand-800 leading-relaxed">{v.analysis}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={handleGenerateVariations}
                          disabled={isGenerating}
                          className="flex-1 py-3 border border-brand-200 text-brand-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors"
                        >
                          <RefreshCw size={18} className={isGenerating ? "animate-spin" : ""} />
                          重新生成
                        </button>
                        <button 
                          onClick={saveToHistory}
                          className="flex-1 py-3 bg-brand-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-600 transition-colors shadow-lg shadow-brand-200"
                        >
                          <Download size={18} />
                          保存到错题本
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-6 space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800">所有错题 ({questions.length})</h3>
                {questions.length > 0 && (
                  <button 
                    onClick={() => setSelectedIds(selectedIds.length === questions.length ? [] : questions.map(q => q.id))}
                    className="text-xs font-medium text-slate-400 hover:text-brand-500"
                  >
                    {selectedIds.length === questions.length ? '取消全选' : '全选'}
                  </button>
                )}
              </div>

              {questions.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-slate-300 gap-4">
                  <History size={48} />
                  <p className="text-sm">还没有保存任何错题</p>
                  <button 
                    onClick={() => setActiveTab('recognition')}
                    className="text-brand-500 font-bold text-sm"
                  >
                    去添加第一道错题
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {questions.map((q) => (
                    <div 
                      key={q.id}
                      className={cn(
                        "bg-white rounded-2xl border transition-all overflow-hidden",
                        selectedIds.includes(q.id) ? "border-brand-500 ring-1 ring-brand-500 shadow-md" : "border-slate-100 shadow-sm"
                      )}
                    >
                      <div className="p-4 flex gap-4">
                        <div 
                          onClick={() => toggleSelect(q.id)}
                          className={cn(
                            "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors cursor-pointer shrink-0 mt-1",
                            selectedIds.includes(q.id) ? "bg-brand-500 border-brand-500" : "border-slate-200"
                          )}
                        >
                          {selectedIds.includes(q.id) && <CheckCircle2 size={12} className="text-white" />}
                        </div>
                        <div className="flex-1 space-y-2 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="px-2 py-0.5 bg-brand-50 text-brand-600 rounded text-[10px] font-bold">
                              {q.knowledgePoint}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(q.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          <p className="text-sm text-slate-700 line-clamp-2 font-medium">{q.originalText}</p>
                          <div className="flex items-center justify-between pt-2">
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                              <Plus size={12} />
                              {q.variations.length} 道变式
                            </div>
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => deleteQuestion(q.id)}
                                className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button className="p-1.5 text-slate-300 hover:text-brand-500 transition-colors">
                                <ChevronRight size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Hidden Print Content */}
      <div className="fixed -left-[9999px] top-0">
        <div ref={printRef} className="w-[210mm] bg-white p-[20mm] space-y-10 text-slate-900">
          <h1 className="text-3xl font-bold text-center border-b-2 border-slate-900 pb-6 mb-10">错题本练习卷</h1>
          {questions.filter(q => selectedIds.includes(q.id)).map((q, idx) => (
            <div key={q.id} className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xl font-bold bg-slate-900 text-white w-8 h-8 flex items-center justify-center rounded">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-bold text-slate-500">知识点：{q.knowledgePoint}</span>
                </div>
                <div className="pl-12 space-y-4">
                  <p className="text-lg leading-relaxed">【原题】{q.originalText}</p>
                  {q.options && (
                    <div className="grid grid-cols-2 gap-4">
                      {q.options.map((opt, i) => (
                        <p key={i} className="text-base">{opt}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="pl-12 space-y-10">
                {q.variations.map((v, vIdx) => (
                  <div key={v.id} className="space-y-4">
                    <p className="text-lg leading-relaxed">【变式 {vIdx + 1}】{v.text}</p>
                    {v.options && (
                      <div className="grid grid-cols-2 gap-4">
                        {v.options.map((opt, i) => (
                          <p key={i} className="text-base">{opt}</p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div className="pl-12 pt-6 border-t border-dashed border-slate-200 space-y-4 page-break-inside-avoid">
                <p className="font-bold text-lg">答案与解析：</p>
                <div className="space-y-6">
                  <p className="text-base"><span className="font-bold">原题答案：</span>{q.correctAnswer}</p>
                  {q.variations.map((v, vIdx) => (
                    <div key={v.id} className="space-y-2">
                      <p className="text-base font-bold">变式 {vIdx + 1}：</p>
                      <p className="text-base"><span className="font-bold">答案：</span>{v.answer}</p>
                      <p className="text-base italic text-slate-600"><span className="font-bold not-italic">解析：</span>{v.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
              {idx < selectedIds.length - 1 && <div className="border-b-2 border-slate-100 my-10" />}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Navigation */}
      <nav className="bg-white border-t border-slate-100 px-8 py-3 flex items-center justify-around sticky bottom-0 z-10">
        <button 
          onClick={() => setActiveTab('recognition')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'recognition' ? "text-brand-500" : "text-slate-400"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-colors",
            activeTab === 'recognition' ? "bg-brand-50" : "bg-transparent"
          )}>
            <Camera size={24} />
          </div>
          <span className="text-[10px] font-bold">错题识别</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "flex flex-col items-center gap-1 transition-colors",
            activeTab === 'history' ? "text-brand-500" : "text-slate-400"
          )}
        >
          <div className={cn(
            "p-2 rounded-xl transition-colors",
            activeTab === 'history' ? "bg-brand-50" : "bg-transparent"
          )}>
            <History size={24} />
          </div>
          <span className="text-[10px] font-bold">错题本</span>
        </button>
      </nav>

      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleImageUpload} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
}

