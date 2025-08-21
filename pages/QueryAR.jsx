
import React, { useState, useEffect } from "react";
import { QuizAR, SubmissionAR, QuestionAR, QuestionBankAR } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Download, FileText, Users, BarChart3, Package } from "lucide-react";
import { format } from "date-fns";

// Helper to dynamically load a script
const loadScript = (src) => {
  return new Promise((resolve, reject) => {
    // Check if script already exists to prevent multiple loads
    if (document.querySelector(`script[src="${src}"]`)) {
      return resolve();
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
    document.head.appendChild(script);
  });
};

export default function QueryAR() {
  const [quizzes, setQuizzes] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    setIsLoading(true);
    try {
      const session = localStorage.getItem('gts_user_session');
      if (!session) return;

      const currentUser = JSON.parse(session);
      const userQuizzes = await QuizAR.filter({ owner_id: currentUser.user_id }, "-updated_date");
      setQuizzes(userQuizzes);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    }
    setIsLoading(false);
  };

  const generateWordDocuments = async () => {
    if (!selectedQuiz) {
      alert("يرجى اختيار اختبار أولاً");
      return;
    }

    setIsGenerating(true);
    try {
      // Dynamically load JSZip library
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

      // Ensure JSZip is available after loading
      if (!window.JSZip) {
        throw new Error("تعذر تحميل مكتبة الضغط. يرجى التحقق من اتصالك بالإنترنت والمحاولة مرة أخرى.");
      }

      const session = localStorage.getItem('gts_user_session');
      const currentUser = JSON.parse(session);

      const quiz = quizzes.find(q => q.id === selectedQuiz);
      if (!quiz) {
        alert("الاختبار غير موجود");
        return;
      }

      const submissions = await SubmissionAR.filter({ 
        quiz_id: selectedQuiz, 
        owner_id: currentUser.user_id 
      });

      if (submissions.length === 0) {
        alert("لا توجد إجابات لهذا الاختبار");
        return;
      }

      const questions = await QuestionAR.filter({ 
        quiz_id: selectedQuiz, 
        owner_id: currentUser.user_id 
      }, "order");

      // Initialize questionMap once for all submissions that use direct quiz questions
      // This map might be extended within generateWordDocument if it's a bank quiz.
      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.id] = q;
      });

      // Initialize JSZip for the main archive
      const zip = new window.JSZip();

      // Generate content for each submission and add to zip file
      for (const submission of submissions) {
        // Pass a *copy* of the questionMap to avoid unintended state sharing across submission processing,
        // although in this specific case, the modification logic within generateWordDocument is designed
        // to populate the map for *that specific call's* needs, so a copy isn't strictly necessary
        // for correctness, but can prevent unexpected side effects if future logic changes.
        // For now, passing the original map by reference is fine as its modifications are contained to the call.
        const docxBlob = await generateWordDocument(
          quiz, 
          submission, 
          questions, 
          questionMap
        );
        // Clean file name for ZIP compatibility and use .docx extension
        const respondentIdentifier = submission.respondent_id_number || submission.respondent_name?.replace(/[^a-zA-Z0-9\u0600-\u06FF\s_]/g, '') || 'submission';
        const fileName = `${respondentIdentifier.replace(/\s+/g, '_')}_${submission.id}.docx`;
        zip.file(fileName, docxBlob);
      }
      
      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" });

      // Create a download link for the zip file
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      // Clean quiz title for file name
      const quizFileName = quiz.title.replace(/[^a-zA-Z0-9\u0600-\u06FF\s_]/g, '').trim().replace(/\s+/g, '_');
      link.download = `${quizFileName}_submissions.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      alert(`تم بنجاح إنشاء وتنزيل ملف مضغوط يحتوي على ${submissions.length} مستند Word!`);

    } catch (error) {
      console.error("Error generating documents:", error);
      alert(`خطأ في إنشاء المستندات: ${error.message}`);
    }
    setIsGenerating(false);
  };

  // Helper function to escape XML characters
  const escapeXml = (unsafe) => {
    if (typeof unsafe !== 'string') return unsafe || '';
    return unsafe.replace(/[<>&'"]/g, function (c) {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  };

  // Helper function to extract the real question ID from a temporary bank ID
  const getRealQuestionId = (id) => {
    if (typeof id === 'string' && id.startsWith('bank_')) {
      const parts = id.split('_');
      if (parts.length > 1) {
        return parts[1]; // The real ID is the second part
      }
    }
    return id; // Return original ID if not a bank ID
  };

  const generateWordDocument = async (quiz, submission, questions, questionMap) => {
    const percentage = Math.round(((submission.score || 0) / (submission.max_score || 1)) * 100);
    
    // Create proper DOCX structure
    const zip = new window.JSZip();
    
    // Add [Content_Types].xml
    zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

    // Add _rels/.rels
    zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

    // Add word/_rels/document.xml.rels
    zip.folder("word").folder("_rels").file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`);

    // Determine the full list of question IDs to process. Fallback for older submissions.
    const questionIdsToRender = (submission.assigned_question_ids && submission.assigned_question_ids.length > 0)
        ? submission.assigned_question_ids
        : (submission.answers || []).map(a => a.question_id);
        
    // If the quiz itself has no directly associated questions, load from QuestionBankAR
    let isQuestionBank = false;
    if (questions.length === 0 && questionIdsToRender.length > 0) {
      try {
        const session = localStorage.getItem('gts_user_session');
        const currentUser = JSON.parse(session);
        
        // Get unique real question IDs from all assigned questions
        const questionIdsToFetch = [...new Set(questionIdsToRender.map(id => getRealQuestionId(id)))];
        
        // Load questions from QuestionBankAR
        const bankQuestions = await QuestionBankAR.filter({ owner_id: currentUser.user_id });
        const relevantBankQuestions = bankQuestions.filter(bq => questionIdsToFetch.includes(bq.id));
        isQuestionBank = true;
        
        // Update questionMap with bank questions
        relevantBankQuestions.forEach(q => {
          questionMap[q.id] = q;
        });
      } catch (error) {
        console.error("Error loading Question Bank questions:", error);
      }
    }

    // Create an answer map for quick lookups
    const answerMap = {};
    if (submission.answers) {
      submission.answers.forEach(ans => {
        answerMap[ans.question_id] = ans;
      });
    }

    // Generate the main document content with RTL support
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Header -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="32"/>
          <w:b/>
          <w:color w:val="0066CC"/>
          <w:rtl/>
        </w:rPr>
        <w:t>نظام الاختبارات GTS</w:t>
      </w:r>
    </w:p>
    
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
          <w:b/>
          <w:rtl/>
        </w:rPr>
        <w:t>سجل رسمي لتقديم الاختبار</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="480"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="20"/>
          <w:rtl/>
        </w:rPr>
        <w:t>${escapeXml(quiz.title)}</w:t>
      </w:r>
    </w:p>

    <!-- Student Information -->
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:b/>
          <w:rtl/>
        </w:rPr>
        <w:t>معلومات الطالب</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>الاسم: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rtl/></w:rPr>
        <w:t>${escapeXml(submission.respondent_name || 'غير متوفر')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>رقم الهوية: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rtl/></w:rPr>
        <w:t>${escapeXml(submission.respondent_id_number || 'غير متوفر')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>المقرر: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rtl/></w:rPr>
        <w:t>${escapeXml(quiz.course_number || 'غير متوفر')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>تاريخ الإكمال: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rtl/></w:rPr>
        <w:t>${submission.completed_at ? format(new Date(submission.completed_at), 'PPpp') : 'غير متوفر'}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>الوقت المستغرق: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:rtl/></w:rPr>
        <w:t>${Math.floor((submission.completion_time || 0) / 60)}:${String((submission.completion_time || 0) % 60).padStart(2, '0')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>النتيجة النهائية: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>${submission.score || 0}/${submission.max_score || 0} (${percentage}%)</w:t>
      </w:r>
    </w:p>

    ${isQuestionBank ? `
    <w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr><w:b/><w:rtl/></w:rPr>
        <w:t>نوع الاختبار: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:color w:val="0066CC"/><w:rtl/></w:rPr>
        <w:t>اختبار ديناميكي (بنك الأسئلة)</w:t>
      </w:r>
    </w:p>
    ` : ''}

    <!-- Questions and Answers -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="480" w:after="240"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:b/>
          <w:rtl/>
        </w:rPr>
        <w:t>الإجابات التفصيلية</w:t>
      </w:r>
    </w:p>

    ${questionIdsToRender && questionIdsToRender.length > 0 ? 
      questionIdsToRender.map((qId, index) => {
        const realQuestionId = getRealQuestionId(qId);
        const question = questionMap[realQuestionId];
        const answer = answerMap[qId];
        
        if (!question) {
          return `
          <w:p>
            <w:pPr>
              <w:spacing w:before="240" w:after="120"/>
              <w:bidi/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="16"/>
                <w:b/>
                <w:rtl/>
              </w:rPr>
              <w:t>السؤال ${index + 1}: [تعذر تحميل نص السؤال - قد يكون محذوفًا. المعرف: ${escapeXml(qId)}]</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:spacing w:after="120"/>
              <w:bidi/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:b/>
                <w:rtl/>
              </w:rPr>
              <w:t>إجابة الطالب: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:color w:val="${answer && answer.is_correct ? '008000' : 'FF0000'}"/>
                <w:rtl/>
              </w:rPr>
              <w:t>${escapeXml(answer ? answer.answer || 'لم يتم تقديم إجابة' : 'لم يتم تقديم إجابة')}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:spacing w:after="240"/>
              <w:bidi/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:b/>
                <w:color w:val="${answer && answer.is_correct ? '008000' : 'FF0000'}"/>
                <w:rtl/>
              </w:rPr>
              <w:t>النتيجة: ${answer && answer.is_correct ? '✓ صحيح' : '✗ خطأ'}</w:t>
            </w:r>
          </w:p>
          `;
        }

        // Handle answered and unanswered questions with full details
        let studentAnswerText = 'لم يتم تقديم إجابة';
        let isCorrect = false;

        if (answer) {
          studentAnswerText = answer.answer || 'لم يتم تقديم إجابة';
          isCorrect = answer.is_correct;
          
          // Handle checkbox answers
          if (question.type === 'checkbox' && studentAnswerText && studentAnswerText !== 'لم يتم تقديم إجابة') {
            try {
                const parsed = JSON.parse(studentAnswerText);
                if (Array.isArray(parsed)) {
                    studentAnswerText = parsed.join('، '); // Use Arabic comma
                }
            } catch (e) { /* Not JSON, keep as is */ }
          }
        }

        return `
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="120"/>
            <w:bidi/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="16"/>
              <w:b/>
              <w:rtl/>
            </w:rPr>
            <w:t>السؤال ${index + 1}: ${escapeXml(question.question)}</w:t>
          </w:r>
        </w:p>

        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
            <w:bidi/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
              <w:rtl/>
            </w:rPr>
            <w:t>إجابة الطالب: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="${isCorrect ? '008000' : 'FF0000'}"/>
              <w:rtl/>
            </w:rPr>
            <w:t>${escapeXml(studentAnswerText)}</w:t>
          </w:r>
        </w:p>

        ${!isCorrect && question.correct_answers && question.correct_answers.length > 0 ? `
        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
            <w:bidi/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
              <w:rtl/>
            </w:rPr>
            <w:t>الإجابة الصحيحة: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="008000"/>
              <w:rtl/>
            </w:rPr>
              <w:t>${escapeXml(question.correct_answers.join('، '))}</w:t>
          </w:r>
        </w:p>
        ` : ''}

        ${question.explanation ? `
        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
            <w:bidi/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
              <w:rtl/>
            </w:rPr>
            <w:t>التفسير: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="92400e"/>
              <w:rtl/>
            </w:rPr>
            <w:t>${escapeXml(question.explanation)}</w:t>
          </w:r>
        </w:p>
        ` : ''}

        <w:p>
          <w:pPr>
            <w:spacing w:after="240"/>
            <w:bidi/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
              <w:color w:val="${isCorrect ? '008000' : 'FF0000'}"/>
              <w:rtl/>
            </w:rPr>
            <w:t>النتيجة: ${isCorrect ? '✓ صحيح' : '✗ خطأ'}</w:t>
          </w:r>
        </w:p>
        `;
      }).join('')
    : 
    `<w:p>
      <w:pPr><w:bidi/></w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="14"/>
          <w:color w:val="FF0000"/>
          <w:rtl/>
        </w:rPr>
        <w:t>لم يتم تسجيل أي إجابات لهذا التقديم.</w:t>
      </w:r>
    </w:p>`
    }

    <!-- Footer -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="480"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
          <w:rtl/>
        </w:rPr>
        <w:t>تم الإنشاء بواسطة نظام GTS للاختبارات في ${format(new Date(), 'PPpp')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
          <w:rtl/>
        </w:rPr>
        <w:t>هذه الوثيقة تُعتبر دليلاً رسمياً على إكمال الاختبار.</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:bidi/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
          <w:rtl/>
        </w:rPr>
        <w:t>عنوان IP: ${escapeXml(submission.ip_address || 'غير مسجل')}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

    // Add the main document
    zip.folder("word").file("document.xml", documentXml);

    // Generate the DOCX file
    return await zip.generateAsync({ type: "blob" });
  };

  const selectedQuizData = quizzes.find(q => q.id === selectedQuiz);

  return (
    <div dir="rtl" className="p-4 md:p-8 space-y-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">الاستعلام والتصدير</h1>
          <p className="text-slate-600">إنشاء مستندات Word مفصلة لإجابات الاختبارات</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              تصدير إجابات الاختبار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                اختر الاختبار
              </label>
              <Select value={selectedQuiz} onValueChange={setSelectedQuiz} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "جاري تحميل الاختبارات..." : "اختر اختباراً للتصدير"} />
                </SelectTrigger>
                <SelectContent>
                  {quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{quiz.title}</span>
                        <Badge variant="outline" className="mr-2">
                          {quiz.status === 'published' ? 'منشور' : 'مسودة'}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedQuizData && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <h3 className="font-medium text-slate-900">تفاصيل الاختبار المختار:</h3>
                <div className="text-sm text-slate-600 space-y-1">
                  <p><strong>العنوان:</strong> {selectedQuizData.title}</p>
                  <p><strong>المقرر:</strong> {selectedQuizData.course_number || 'غير متوفر'}</p>
                  <p><strong>الحالة:</strong> {selectedQuizData.status === 'published' ? 'منشور' : 'مسودة'}</p>
                  <p><strong>تاريخ الإنشاء:</strong> {format(new Date(selectedQuizData.created_date), 'PPp')}</p>
                </div>
              </div>
            )}

            <div className="border-t pt-6">
              <Button
                onClick={generateWordDocuments}
                disabled={!selectedQuiz || isGenerating}
                className="w-full gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري إنشاء المستندات...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    إنشاء مستندات Word (ملف مضغوط)
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                سيتم إنشاء مستندات Word منفصلة لكل إجابة وتعبئتها في ملف مضغوط.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <CardTitle>ما هو مُتضمن</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">معلومات الطالب</h4>
                  <p className="text-sm text-slate-600">الاسم، رقم الهوية، تفاصيل المقرر، ووقت الإكمال</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">تحليل النتائج</h4>
                  <p className="text-sm text-slate-600">النتيجة الإجمالية، النسبة المئوية، وحالة النجاح/الرسوب</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">الإجابات التفصيلية</h4>
                  <p className="text-sm text-slate-600">كل سؤال مع إجابة الطالب والإجابة الصحيحة</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">تنسيق احترافي</h4>
                  <p className="text-sm text-slate-600">مستندات Word مُعلمة بخلفية GTS مع دعم RTL للنصوص العربية</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
