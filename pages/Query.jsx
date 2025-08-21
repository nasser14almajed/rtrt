
import React, { useState, useEffect } from "react";
import { Quiz, Submission, Question, QuestionBank } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle }
from "@/components/ui/card";
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
    // Check if script already exists to avoid re-adding
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

export default function Query() {
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
      const userQuizzes = await Quiz.filter({ owner_id: currentUser.user_id }, "-updated_date");
      setQuizzes(userQuizzes);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    }
    setIsLoading(false);
  };

  const generateWordDocuments = async () => {
    if (!selectedQuiz) {
      alert("Please select a quiz first");
      return;
    }

    setIsGenerating(true);
    try {
      // Dynamically load the JSZip library from a CDN
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');

      if (!window.JSZip) {
        throw new Error("Could not load the ZIP library. Please check your network connection and try again.");
      }

      const session = localStorage.getItem('gts_user_session');
      const currentUser = JSON.parse(session);

      // Get quiz details
      const quiz = quizzes.find(q => q.id === selectedQuiz);
      if (!quiz) {
        alert("Quiz not found");
        return;
      }

      // Get submissions for the selected quiz
      const submissions = await Submission.filter({ 
        quiz_id: selectedQuiz, 
        owner_id: currentUser.user_id 
      });

      if (submissions.length === 0) {
        alert("No submissions found for this quiz");
        return;
      }

      // Get all questions for the quiz
      const questions = await Question.filter({ 
        quiz_id: selectedQuiz, 
        owner_id: currentUser.user_id 
      }, "order");

      // Create a map for quick question lookup
      const questionMap = {};
      questions.forEach(q => {
        questionMap[q.id] = q;
      });

      const zip = new window.JSZip();

      // Create individual Word documents and add them to the ZIP archive
      for (const submission of submissions) {
        const docxBlob = await generateWordDocument(
          quiz, 
          submission, 
          questions, 
          questionMap
        );

        // Clean up file name to be filesystem-friendly
        const respondentIdentifier = submission.respondent_id_number || submission.respondent_name?.replace(/[^a-zA-Z0-9\s]/g, '').trim() || 'submission';
        const fileName = `${respondentIdentifier.replace(/\s+/g, '_')}_${submission.id}.docx`;
        zip.file(fileName, docxBlob);
      }

      // Generate and download the ZIP file
      const quizFileName = quiz.title.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
      const zipFileName = `${quizFileName}_submissions.zip`;
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(zipBlob);
      link.download = zipFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      alert(`Successfully generated and downloaded a ZIP file with ${submissions.length} Word documents!`);

    } catch (error) {
      console.error("Error generating documents:", error);
      alert(`Error generating documents: ${error.message}`);
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
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
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

    // Try to load Question Bank questions if regular questions are not found
    let allQuestions = questions; // This variable is not used after this point, the questionMap is updated directly
    let isQuestionBank = false;
    
    if (questions.length === 0 && submission.answers && submission.answers.length > 0) {
      try {
        const session = localStorage.getItem('gts_user_session');
        const currentUser = JSON.parse(session);
        
        // Get unique question IDs from submission
        const questionIds = [...new Set(submission.answers.map(a => a.question_id))];
        
        // Load questions from QuestionBank
        const bankQuestions = await QuestionBank.filter({ owner_id: currentUser.user_id });
        allQuestions = bankQuestions.filter(bq => questionIds.includes(bq.id));
        isQuestionBank = true;
        
        // Update questionMap with bank questions
        allQuestions.forEach(q => {
          questionMap[q.id] = q;
        });
      } catch (error) {
        console.error("Error loading Question Bank questions:", error);
      }
    }

    // Generate the main document content
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <!-- Header -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="32"/>
          <w:b/>
          <w:color w:val="0066CC"/>
        </w:rPr>
        <w:t>GTS QUIZ SYSTEM</w:t>
      </w:r>
    </w:p>
    
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="24"/>
          <w:b/>
        </w:rPr>
        <w:t>OFFICIAL QUIZ SUBMISSION RECORD</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:after="480"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>${escapeXml(quiz.title)}</w:t>
      </w:r>
    </w:p>

    <!-- Student Information -->
    <w:p>
      <w:pPr>
        <w:spacing w:after="120"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:b/>
        </w:rPr>
        <w:t>STUDENT INFORMATION</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Name: </w:t>
      </w:r>
      <w:r>
        <w:t>${escapeXml(submission.respondent_name || 'N/A')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>ID Number: </w:t>
      </w:r>
      <w:r>
        <w:t>${escapeXml(submission.respondent_id_number || 'N/A')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Course: </w:t>
      </w:r>
      <w:r>
        <w:t>${escapeXml(quiz.course_number || 'N/A')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Completed: </w:t>
      </w:r>
      <w:r>
        <w:t>${submission.completed_at ? format(new Date(submission.completed_at), 'PPpp') : 'N/A'}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Time Taken: </w:t>
      </w:r>
      <w:r>
        <w:t>${Math.floor((submission.completion_time || 0) / 60)}:${String((submission.completion_time || 0) % 60).padStart(2, '0')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Final Score: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>${submission.score || 0}/${submission.max_score || 0} (${percentage}%)</w:t>
      </w:r>
    </w:p>

    ${isQuestionBank ? `
    <w:p>
      <w:r>
        <w:rPr><w:b/></w:rPr>
        <w:t>Quiz Type: </w:t>
      </w:r>
      <w:r>
        <w:rPr><w:color w:val="0066CC"/></w:rPr>
        <w:t>Dynamic Quiz (Question Bank)</w:t>
      </w:r>
    </w:p>
    ` : ''}

    <!-- Questions and Answers -->
    <w:p>
      <w:pPr>
        <w:spacing w:before="480" w:after="240"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="18"/>
          <w:b/>
        </w:rPr>
        <w:t>DETAILED ANSWERS</w:t>
      </w:r>
    </w:p>

    ${submission.answers && submission.answers.length > 0 ? 
      submission.answers.map((answer, index) => {
        const question = questionMap[answer.question_id];
        
        if (!question) {
          return `
          <w:p>
            <w:pPr>
              <w:spacing w:before="240" w:after="120"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="16"/>
                <w:b/>
              </w:rPr>
              <w:t>Question ${index + 1}: [Question data not available - ID: ${escapeXml(answer.question_id)}]</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:spacing w:after="120"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:b/>
              </w:rPr>
              <w:t>Student Answer: </w:t>
            </w:r>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:color w:val="${answer.is_correct ? '008000' : 'FF0000'}"/>
              </w:rPr>
              <w:t>${escapeXml(answer.answer || 'No answer provided')}</w:t>
            </w:r>
          </w:p>
          <w:p>
            <w:pPr>
              <w:spacing w:after="240"/>
            </w:pPr>
            <w:r>
              <w:rPr>
                <w:sz w:val="14"/>
                <w:b/>
                <w:color w:val="${answer.is_correct ? '008000' : 'FF0000'}"/>
              </w:rPr>
              <w:t>Result: ${answer.is_correct ? '✓ CORRECT' : '✗ INCORRECT'}</w:t>
            </w:r>
          </w:p>
          `;
        }

        let studentAnswerText = answer.answer;
        if (question.type === 'checkbox' && studentAnswerText) {
            try {
                const parsed = JSON.parse(studentAnswerText);
                if (Array.isArray(parsed)) {
                    studentAnswerText = parsed.join(', ');
                }
            } catch (e) { /* Not JSON, do nothing */ }
        }
        studentAnswerText = studentAnswerText || 'No answer provided';

        return `
        <w:p>
          <w:pPr>
            <w:spacing w:before="240" w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="16"/>
              <w:b/>
            </w:rPr>
            <w:t>Question ${index + 1}: ${escapeXml(question.question)}</w:t>
          </w:r>
        </w:p>

        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
            </w:rPr>
            <w:t>Student Answer: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="${answer.is_correct ? '008000' : 'FF0000'}"/>
            </w:rPr>
            <w:t>${escapeXml(studentAnswerText)}</w:t>
          </w:r>
        </w:p>

        ${!answer.is_correct && question.correct_answers && question.correct_answers.length > 0 ? `
        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
            </w:rPr>
            <w:t>Correct Answer: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="008000"/>
            </w:rPr>
              <w:t>${escapeXml(question.correct_answers.join(', '))}</w:t>
          </w:r>
        </w:p>
        ` : ''}

        ${question.explanation ? `
        <w:p>
          <w:pPr>
            <w:spacing w:after="120"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
            </w:rPr>
            <w:t>Explanation: </w:t>
          </w:r>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:color w:val="92400e"/>
            </w:rPr>
            <w:t>${escapeXml(question.explanation)}</w:t>
          </w:r>
        </w:p>
        ` : ''}

        <w:p>
          <w:pPr>
            <w:spacing w:after="240"/>
          </w:pPr>
          <w:r>
            <w:rPr>
              <w:sz w:val="14"/>
              <w:b/>
              <w:color w:val="${answer.is_correct ? '008000' : 'FF0000'}"/>
            </w:rPr>
            <w:t>Result: ${answer.is_correct ? '✓ CORRECT' : '✗ INCORRECT'}</w:t>
          </w:r>
        </w:p>
        `;
      }).join('')
    : 
    `<w:p>
      <w:r>
        <w:rPr>
          <w:sz w:val="14"/>
          <w:color w:val="FF0000"/>
        </w:rPr>
        <w:t>No answers were recorded for this submission.</w:t>
      </w:r>
    </w:p>`
    }

    <!-- Footer -->
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="480"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
        </w:rPr>
        <w:t>Generated by GTS Quiz System on ${format(new Date(), 'PPpp')}</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
        </w:rPr>
        <w:t>This document serves as official evidence of quiz completion.</w:t>
      </w:r>
    </w:p>

    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:sz w:val="12"/>
          <w:color w:val="666666"/>
        </w:rPr>
        <w:t>IP Address: ${escapeXml(submission.ip_address || 'Not recorded')}</w:t>
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
    <div className="p-4 md:p-8 space-y-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Query & Export</h1>
          <p className="text-slate-600">Generate detailed Word documents for quiz submissions</p>
        </div>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Export Quiz Submissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">
                Select Quiz
              </label>
              <Select value={selectedQuiz} onValueChange={setSelectedQuiz} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Loading quizzes..." : "Choose a quiz to export"} />
                </SelectTrigger>
                <SelectContent>
                  {quizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{quiz.title}</span>
                        <Badge variant="outline" className="ml-2">
                          {quiz.status}
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedQuizData && (
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <h3 className="font-medium text-slate-900">Selected Quiz Details:</h3>
                <div className="text-sm text-slate-600 space-y-1">
                  <p><strong>Title:</strong> {selectedQuizData.title}</p>
                  <p><strong>Course:</strong> {selectedQuizData.course_number || 'N/A'}</p>
                  <p><strong>Status:</strong> {selectedQuizData.status}</p>
                  <p><strong>Created:</strong> {format(new Date(selectedQuizData.created_date), 'PPp')}</p>
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
                    Generating Documents...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Word Documents (ZIP)
                  </>
                )}
              </Button>
              <p className="text-xs text-slate-500 mt-2 text-center">
                This will create individual Word documents for each submission and package them in a ZIP file.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60 mt-8">
          <CardHeader>
            <CardTitle>What's Included</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-medium">Student Information</h4>
                  <p className="text-sm text-slate-600">Name, ID number, course details, and completion time</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BarChart3 className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <h4 className="font-medium">Score Analysis</h4>
                  <p className="text-sm text-slate-600">Total score, percentage, and pass/fail status</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FileText className="w-4 h-4 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-medium">Detailed Answers</h4>
                  <p className="text-sm text-slate-600">Each question with student answer and correct answer</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Package className="w-4 h-4 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-medium">Official Format</h4>
                  <p className="text-sm text-slate-600">Properly formatted .docx files for official records</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
