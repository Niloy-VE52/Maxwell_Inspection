import React, { useState, useEffect, useRef, useMemo } from 'react';
import type { Section, InspectionItemResult, InspectionItem } from '../types';
import { MAXWELL_SECTIONS, QUICK_DEFECT_TAGS } from '../data/templateData';
import { generateInspectionPdf } from '../services/pdfGenerator';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { SignatureSelector } from '../components/SignatureSelector';
import confetti from 'canvas-confetti';
import {
  Check,
  X,
  FileDown,
  Printer,
  CheckCircle2,
  Cloud,
  RefreshCw,
  Send,
  Sparkles,
  Edit3,
} from 'lucide-react';

const STORAGE_KEY = 'maxwell_active_inspection';

export const InspectionForm: React.FC = () => {
  const { user } = useAuth();

  // Sections
  const sections: Section[] = MAXWELL_SECTIONS;

  // Header State
  const [roomNumber, setRoomNumber] = useState<string>('101');
  const [roomType, setRoomType] = useState<string>('Deluxe');
  const [overallRemark, setOverallRemark] = useState<string>('');
  const [selectedSignatureUrl, setSelectedSignatureUrl] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  // Items State (checklist_item_id -> InspectionItem)
  const [itemsMap, setItemsMap] = useState<Record<number, InspectionItem>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  // Autosave timeout ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load saved state on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (data.roomNumber) setRoomNumber(data.roomNumber);
        if (data.roomType) setRoomType(data.roomType);
        if (data.overallRemark) setOverallRemark(data.overallRemark);
        if (data.selectedSignatureUrl) setSelectedSignatureUrl(data.selectedSignatureUrl);
        if (data.itemsMap) setItemsMap(data.itemsMap);
        if (data.isSubmitted) setIsSubmitted(data.isSubmitted);
        if (data.submittedAt) setSubmittedAt(data.submittedAt);
      }
    } catch (e) {
      console.warn('Error loading inspection from storage', e);
    }
  }, []);

  // Save to localStorage
  const saveInspectionState = (override?: Partial<{
    roomNumber: string;
    roomType: string;
    overallRemark: string;
    selectedSignatureUrl: string | null;
    itemsMap: Record<number, InspectionItem>;
    isSubmitted: boolean;
    submittedAt: string | null;
  }>) => {
    setIsSaving(true);
    const stateToSave = {
      roomNumber,
      roomType,
      overallRemark,
      selectedSignatureUrl,
      itemsMap,
      isSubmitted,
      submittedAt,
      ...override,
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
      setLastSaved(new Date());
    } catch (e) {
      console.warn('Error saving inspection to storage', e);
    } finally {
      setTimeout(() => setIsSaving(false), 250);
    }
  };

  const triggerAutosave = () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveTimeoutRef.current = setTimeout(() => {
      saveInspectionState();
    }, 400);
  };

  // Handle individual checklist item result
  const handleItemResult = (
    checklistItemId: number,
    result: InspectionItemResult,
    remark?: string
  ) => {
    setItemsMap((prev) => {
      const existing = prev[checklistItemId];
      const updatedRemark = remark !== undefined ? remark : existing?.remark || null;

      const updatedItem: InspectionItem = {
        id: checklistItemId,
        inspection_id: 1,
        checklist_item_id: checklistItemId,
        result,
        remark: updatedRemark,
        photo_url: null,
      };

      const newMap = {
        ...prev,
        [checklistItemId]: updatedItem,
      };

      saveInspectionState({ itemsMap: newMap });
      return newMap;
    });
  };

  // Shortcut: Mark entire section items as PASS
  const handlePassSection = (section: Section) => {
    setItemsMap((prev) => {
      const newMap = { ...prev };
      section.items.forEach((item) => {
        const existing = newMap[item.id];
        if (!existing || !existing.result) {
          newMap[item.id] = {
            id: item.id,
            inspection_id: 1,
            checklist_item_id: item.id,
            result: 'pass',
            remark: existing?.remark || null,
            photo_url: null,
          };
        }
      });
      saveInspectionState({ itemsMap: newMap });
      return newMap;
    });
  };

  // Handle Signature Selection
  const handleSelectSignature = (sigUrl: string | null) => {
    setSelectedSignatureUrl(sigUrl);
    saveInspectionState({ selectedSignatureUrl: sigUrl });
  };

  // Reset / Clear Form for new room
  const handleResetForm = () => {
    if (
      window.confirm(
        'Start a new inspection? Current form answers will be reset for a new room inspection.'
      )
    ) {
      setItemsMap({});
      setOverallRemark('');
      setIsSubmitted(false);
      setSubmittedAt(null);
      localStorage.removeItem(STORAGE_KEY);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Submit Inspection
  const handleSubmit = () => {
    if (!selectedSignatureUrl) {
      alert('Please select or upload/draw your inspector signature before submitting.');
      const footerEl = document.getElementById('form-footer');
      if (footerEl) footerEl.scrollIntoView({ behavior: 'smooth' });
      return;
    }

    const nowStr = new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    setIsSubmitted(true);
    setSubmittedAt(nowStr);
    saveInspectionState({ isSubmitted: true, submittedAt: nowStr });

    try {
      confetti({
        particleCount: 120,
        spread: 90,
        origin: { y: 0.6 },
      });
    } catch (e) { }

    // Scroll to action area
    const actionsEl = document.getElementById('submission-actions');
    if (actionsEl) {
      actionsEl.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Download PDF
  const handleDownloadPdf = () => {
    const formattedDate = submittedAt || new Date().toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    generateInspectionPdf({
      roomNumber,
      roomType,
      inspectionDate: formattedDate,
      status: isSubmitted ? 'submitted' : 'in_progress',
      sections,
      itemsMap,
      overallRemark,
      inspectorName: user?.full_name || 'Inspector John Tan',
      signatureUrl: selectedSignatureUrl,
      verifiedByName: user?.role === 'supervisor' ? user.full_name : 'Sarah Lee (Supervisor)',
      verifiedAt: isSubmitted ? formattedDate : undefined,
    });
  };

  // Stats calculation
  const { totalCount, answeredCount, passCount, failCount, naCount } = useMemo(() => {
    let total = 0;
    let answered = 0;
    let pass = 0;
    let fail = 0;
    let na = 0;

    sections.forEach((sec) => {
      total += sec.items.length;
      sec.items.forEach((item) => {
        const ans = itemsMap[item.id];
        if (ans && ans.result) {
          answered++;
          if (ans.result === 'pass') pass++;
          else if (ans.result === 'fail') fail++;
          else if (ans.result === 'na') na++;
        }
      });
    });

    return { totalCount: total, answeredCount: answered, passCount: pass, failCount: fail, naCount: na };
  }, [sections, itemsMap]);

  const scrollToSection = (code: string) => {
    const el = document.getElementById(`section-${code}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const inspectionDateDisplay = submittedAt || new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-slate-200/70 flex flex-col pb-32">
      <Navbar onResetForm={handleResetForm} />

      {/* Sticky Floating Section Navigator */}
      <div className="sticky top-16 z-30 bg-slate-900/95 backdrop-blur text-white shadow-md border-b border-slate-800 py-2.5 px-4 print:hidden">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none">
            <span className="text-[11px] uppercase font-bold text-amber-400 mr-2 flex-shrink-0">
              Sections:
            </span>
            {sections.map((sec) => {
              const answeredSec = sec.items.filter((i) => itemsMap[i.id]?.result).length;
              const hasFail = sec.items.some((i) => itemsMap[i.id]?.result === 'fail');
              const isDone = answeredSec === sec.items.length && sec.items.length > 0;

              return (
                <button
                  key={sec.id}
                  onClick={() => scrollToSection(sec.code)}
                  title={`${sec.code}. ${sec.title} (${answeredSec}/${sec.items.length})`}
                  className={`w-7 h-7 rounded-lg text-xs font-bold flex items-center justify-center transition flex-shrink-0 cursor-pointer ${hasFail
                      ? 'bg-rose-500 text-white'
                      : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                >
                  {sec.code}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3 flex-shrink-0 text-xs">
            <div className="hidden sm:flex items-center gap-2 text-slate-300 font-medium">
              <span className="text-emerald-400 font-bold">{passCount} ✓</span>
              {failCount > 0 && <span className="text-rose-400 font-bold">{failCount} ✗</span>}
              {naCount > 0 && <span className="text-slate-400 font-medium">{naCount} NA</span>}
              <span className="text-slate-400">
                ({answeredCount}/{totalCount})
              </span>
            </div>
            {isSaving ? (
              <span className="text-amber-400 flex items-center gap-1 text-[11px] animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" /> Saving...
              </span>
            ) : (
              <span
                className="text-emerald-400 flex items-center gap-1 text-[11px]"
                title={lastSaved ? `Last saved at ${lastSaved.toLocaleTimeString()}` : 'Saved locally'}
              >
                <Cloud className="w-3 h-3" /> Saved
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main Form Sheet */}
      <main className="max-w-5xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6">
        {/* Status Callout Banner */}
        {isSubmitted && (
          <div className="mb-6 p-4 rounded-2xl bg-emerald-950/80 border border-emerald-700 text-emerald-100 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl print:hidden">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-base text-white">
                  Inspection Officially Submitted!
                </div>
                <div className="text-xs text-emerald-200">
                  Room {roomNumber} ({roomType}) checklist is finalized. Download your official PDF report below.
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleDownloadPdf}
                className="py-2 px-4 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 flex items-center gap-1.5 shadow transition cursor-pointer"
              >
                <FileDown className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={() => setIsSubmitted(false)}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-emerald-900 hover:bg-emerald-800 text-emerald-200 border border-emerald-700 flex items-center gap-1 transition cursor-pointer"
                title="Unlock editing"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-xl border border-slate-300 p-6 sm:p-10 text-slate-900">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 text-center">
            <h1 className="text-2xl sm:text-3xl font-extrabold font-brand tracking-wider text-slate-900 uppercase">
              MAXWELL INSPECTION LIST
            </h1>
            <div className="text-xs text-slate-500 tracking-widest uppercase font-semibold mt-1">
              The Maxwell &bull; Preventive Maintenance Checklist Form
            </div>
          </div>

          {/* Form Header Fields: Type & Room */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-8">
            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Type:
              </label>
              <input
                type="text"
                disabled={isSubmitted}
                value={roomType}
                onChange={(e) => {
                  setRoomType(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. Deluxe, Suite..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-700 mb-1.5">
                Room Number:
              </label>
              <input
                type="text"
                disabled={isSubmitted}
                value={roomNumber}
                onChange={(e) => {
                  setRoomNumber(e.target.value);
                  triggerAutosave();
                }}
                placeholder="e.g. 101, 102..."
                className="w-full text-sm font-semibold px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 disabled:bg-slate-100"
              />
            </div>
          </div>

          {/* Form Sections (A through K) */}
          <div className="space-y-8">
            {sections.map((section) => {
              return (
                <div
                  key={section.id}
                  id={`section-${section.code}`}
                  className="scroll-mt-32"
                >
                  {/* Section Title Header */}
                  <div className="flex items-center justify-between bg-slate-100/90 px-4 py-2.5 rounded-lg border-l-4 border-slate-900 mb-2">
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 uppercase tracking-wide">
                      {section.code}. {section.title}
                    </h2>
                    {!isSubmitted && (
                      <button
                        type="button"
                        onClick={() => handlePassSection(section)}
                        className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300 flex items-center gap-1 transition cursor-pointer print:hidden"
                      >
                        <Check className="w-3 h-3 text-emerald-600" />
                        <span>Pass Section</span>
                      </button>
                    )}
                  </div>

                  {/* Section Table Matching Checklist */}
                  <div className="overflow-x-auto border border-slate-300 rounded-lg">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-slate-700 font-bold uppercase text-[11px]">
                          <th className="py-2 px-3 w-12 text-center border-r border-slate-300">#</th>
                          <th className="py-2 px-4 border-r border-slate-300">Checklist Item</th>
                          <th className="py-2 px-3 w-36 text-center border-r border-slate-300">
                            <div className="flex items-center justify-center gap-1">
                              <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                              <span className="text-slate-400 font-normal">/</span>
                              <X className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                            </div>
                          </th>
                          <th className="py-2 px-4 w-64">Remarks / Defect Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {section.items.map((item) => {
                          const ans = itemsMap[item.id];
                          const res = ans?.result;
                          const rem = ans?.remark || '';
                          const isFail = res === 'fail';

                          return (
                            <tr
                              key={item.id}
                              className={`transition-colors ${isFail
                                  ? 'bg-rose-50/60'
                                  : res === 'pass'
                                    ? 'hover:bg-slate-50'
                                    : 'hover:bg-slate-50'
                                }`}
                            >
                              {/* # column */}
                              <td className="py-2 px-3 font-bold text-center text-slate-600 border-r border-slate-200 align-top">
                                {item.item_no}
                              </td>

                              {/* Item Description */}
                              <td className="py-2 px-4 text-slate-900 border-r border-slate-200 align-top font-medium leading-relaxed">
                                {item.description}
                              </td>

                              {/* Toggle Buttons (√ / X / N/A) */}
                              <td className="py-2 px-3 border-r border-slate-200 align-top text-center">
                                <div className="inline-flex items-center gap-1">
                                  {/* PASS BUTTON */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'pass', rem)}
                                    title="Mark as Pass (√)"
                                    className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-default ${res === 'pass'
                                        ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600/30'
                                        : 'bg-slate-100 hover:bg-emerald-50 text-slate-500 hover:text-emerald-700'
                                      }`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                  </button>

                                  {/* FAIL BUTTON */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'fail', rem)}
                                    title="Mark as Fail (X)"
                                    className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-default ${res === 'fail'
                                        ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-600/30'
                                        : 'bg-slate-100 hover:bg-rose-50 text-slate-500 hover:text-rose-700'
                                      }`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>

                                  {/* N/A BUTTON */}
                                  <button
                                    type="button"
                                    disabled={isSubmitted}
                                    onClick={() => handleItemResult(item.id, 'na', rem)}
                                    title="Mark as N/A"
                                    className={`px-1.5 h-7 rounded text-[10px] font-bold flex items-center justify-center transition cursor-pointer disabled:cursor-default ${res === 'na'
                                        ? 'bg-slate-700 text-white'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700'
                                      }`}
                                  >
                                    NA
                                  </button>
                                </div>
                              </td>

                              {/* Remarks column */}
                              <td className="py-2 px-3 align-top">
                                <div className="space-y-1">
                                  <input
                                    type="text"
                                    disabled={isSubmitted}
                                    value={rem}
                                    onChange={(e) =>
                                      handleItemResult(item.id, res || 'fail', e.target.value)
                                    }
                                    placeholder={
                                      isFail
                                        ? 'Describe defect / repair required...'
                                        : 'Optional remarks...'
                                    }
                                    className={`w-full text-xs px-2.5 py-1.5 rounded border focus:outline-none focus:ring-1 ${isFail
                                        ? 'border-rose-300 focus:ring-rose-400 bg-white'
                                        : 'border-slate-200 focus:ring-slate-400 bg-white'
                                      } disabled:bg-slate-50`}
                                  />
                                  {isFail && !isSubmitted && (
                                    <div className="flex items-center gap-1 flex-wrap pt-0.5 print:hidden">
                                      {QUICK_DEFECT_TAGS.slice(0, 3).map((tag) => (
                                        <button
                                          key={tag}
                                          type="button"
                                          onClick={() => {
                                            const updated = rem ? `${rem}, ${tag}` : tag;
                                            handleItemResult(item.id, 'fail', updated);
                                          }}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium cursor-pointer"
                                        >
                                          + {tag}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Overall Remarks Box */}
          <div className="mt-8 pt-6 border-t-2 border-slate-200">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Overall Remarks & Notes:
            </label>
            <textarea
              rows={3}
              disabled={isSubmitted}
              value={overallRemark}
              onChange={(e) => {
                setOverallRemark(e.target.value);
                triggerAutosave();
              }}
              placeholder="Any additional observations or maintenance follow-ups for this room..."
              className="w-full text-xs sm:text-sm p-3 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900 transition disabled:bg-slate-50"
            />
          </div>

          {/* Form Footer Matching Template: Date / Inspected By / Verified By */}
          <div id="form-footer" className="mt-8 pt-6 border-t-2 border-slate-900">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Date Box */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Date:
                  </div>
                  <div className="text-base font-bold text-slate-900">{inspectionDateDisplay}</div>
                </div>
                <div className="text-[11px] text-slate-400 mt-4">
                  Official inspection timestamp
                </div>
              </div>

              {/* Inspected By & Signature Picture */}
              <div className="p-4 rounded-xl border border-slate-300 bg-white flex flex-col justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Inspected By:
                  </div>
                  <div className="text-sm font-bold text-slate-800">
                    {user?.full_name || 'Inspector John Tan'}
                  </div>

                  {/* Display selected/drawn signature */}
                  {selectedSignatureUrl ? (
                    <div className="p-3 border-2 border-slate-300 rounded-xl bg-slate-50/80 my-2 flex flex-col items-center justify-center min-h-[70px]">
                      <img
                        src={selectedSignatureUrl}
                        alt="Inspector Signature"
                        className="max-h-16 max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div className="h-16 border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 flex items-center justify-center text-xs text-slate-400 my-2">
                      (Select or draw signature picture below)
                    </div>
                  )}
                </div>

                {!isSubmitted ? (
                  <div className="mt-2 print:hidden">
                    <SignatureSelector
                      selectedSignatureUrl={selectedSignatureUrl}
                      onSelectSignature={handleSelectSignature}
                      inspectorName={user?.full_name}
                    />
                  </div>
                ) : (
                  <div className="text-center text-[11px] text-emerald-700 font-semibold mt-2">
                    ✓ Attached Digital Signature
                  </div>
                )}
              </div>

              {/* Verified By */}
              <div className="p-4 rounded-xl border border-slate-300 bg-slate-50 flex flex-col justify-between">
                <div>
                  <div className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-1">
                    Verified By:
                  </div>
                  <div className="text-sm font-bold text-slate-900">
                    {user?.role === 'supervisor' ? user.full_name : 'Sarah Lee (Supervisor)'}
                  </div>
                  <div className="text-xs text-emerald-600 font-medium mt-1">
                    Verified on {inspectionDateDisplay}
                  </div>
                </div>
                <div className="text-[11px] text-slate-400 mt-4">
                  Engineering supervisor sign-off
                </div>
              </div>
            </div>
          </div>

          {/* Submission and PDF Download Actions */}
          <div
            id="submission-actions"
            className="mt-8 pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 print:hidden"
          >
            <div className="text-xs text-slate-500">
              {isSubmitted ? (
                <span className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> This inspection is officially submitted.
                </span>
              ) : (
                <span>Ensure all sections are checked and signature is selected before submitting.</span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              {isSubmitted ? (
                <>
                  <button
                    type="button"
                    onClick={handleDownloadPdf}
                    className="flex-1 sm:flex-initial py-3 px-6 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                  >
                    <FileDown className="w-4 h-4 text-amber-400" />
                    <span>Download PDF Report</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-3 px-4 rounded-xl text-sm font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="w-full sm:w-auto py-3 px-8 rounded-xl text-sm font-bold bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center gap-2 shadow-lg shadow-slate-900/20 transition cursor-pointer"
                >
                  <Send className="w-4 h-4 text-amber-400" />
                  <span>Submit Official Inspection</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
