
import React, { useState, useEffect } from "react";
import { QuizAR, QuestionAR, QuestionBankAR } from "@/api/entities";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye, Clock, FileText, Users, Settings, CheckCircle, Circle, Square, Type, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function PreviewAR() {
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (id) {
      loadQuiz(id);
    } else {
      setIsLoading(false);
    }
  }, []);

  const loadQuiz = async (id) => {
    setIsLoading(true);
    try {
      const loadedQuiz = await QuizAR.get(id);
      setQuiz(loadedQuiz);

      // Load questions
      if (loadedQuiz.settings?.use_question_bank) {
        const filter = {};
        const categories = loadedQuiz.settings.question_categories;
        const difficulties = loadedQuiz.settings.difficulty_filter;

        if (categories && categories.length > 0) {
          filter.category = { $in: categories };
        }
        if (difficulties && difficulties.length > 0) {
          filter.difficulty = { $in: difficulties };
        }

        const bankQuestions = await QuestionBankAR.filter(filter);

        if (!bankQuestions || bankQuestions.length === 0) {
           console.error("No questions found in AR Question Bank for the given criteria.", filter);
           setQuestions([]);
        } else {
          const shuffled = bankQuestions.sort(() => 0.5 - Math.random());
          const questionsToServe = loadedQuiz.settings.questions_per_user || bankQuestions.length;
          setQuestions(shuffled.slice(0, questionsToServe));
        }
      } else {
        const questions = await QuestionAR.filter({ quiz_id: id }, 'order');
        setQuestions(questions);
      }
    } catch (error) {
      console.error("Error loading AR quiz for preview:", error);
    }
    setIsLoading(false);
  };

  const getQuestionIcon = (type) => {
    switch (type) {
      case 'multiple_choice': return <Circle className="w-4 h-4" />;
      case 'checkbox': return <Square className="w-4 h-4" />;
      case 'true_false': return <CheckCircle className="w-4 h-4" />;
      case 'text': return <Type className="w-4 h-4" />;
      case 'fill_blank': return <Type className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getQuestionTypeLabel = (type) => {
    switch (type) {
      case 'multiple_choice': return 'اختيار من متعدد';
      case 'checkbox': return 'اختيارات متعددة';
      case 'true_false': return 'صح/خطأ';
      case 'text': return 'إجابة نصية';
      case 'fill_blank': return 'أكمل الفراغ';
      default: return type;
    }
  };

  const backgroundImageUrl = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/0c17a432c_9e12b837-8df9-4230-9dc3-6fa94740aa0c.png';
  const backgroundStyle = {
    backgroundImage: `url('${backgroundImageUrl}')`,
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '400px auto',
    backgroundAttachment: 'fixed',
    backgroundColor: '#f8fafc'
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <div className="relative z-10">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600 text-center">جاري تحميل المعاينة...</p>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 flex items-center justify-center p-4" style={backgroundStyle}>
        <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
        <Card className="max-w-md w-full bg-white/90 backdrop-blur-sm relative z-10">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">❌</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">لم يتم العثور على الاختبار</h2>
            <p className="text-slate-600">الاختبار غير موجود أو لا يمكن الوصول إليه.</p>
            <Link to={createPageUrl("DashboardAR")}>
              <Button className="mt-4">العودة إلى لوحة التحكم</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 relative" style={backgroundStyle}>
      <div className="absolute inset-0 bg-white/60 backdrop-blur-[0.5px]"></div>
      <div className="relative z-10">
        <div className="p-4 md:p-8">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to={createPageUrl("DashboardAR")}>
              <Button variant="outline" size="icon" className="hover:bg-slate-100">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-5 h-5 text-slate-600" />
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">معاينة الاختبار</h1>
              </div>
              <p className="text-slate-600">اعرض كيف سيبدو اختبارك للمختبرين</p>
            </div>
          </div>

          {/* Quiz Overview */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                    {quiz.title}
                    {quiz.course_number && (
                      <Badge variant="outline">
                        المقرر: {quiz.course_number}
                      </Badge>
                    )}
                  </CardTitle>
                  {quiz.description && (
                    <p className="text-slate-600 text-lg">{quiz.description}</p>
                  )}
                </div>
                <Badge variant={quiz.status === 'published' ? 'default' : 'secondary'}
                       className={quiz.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-slate-100'}>
                  {quiz.status === 'published' ? 'منشور' : 'مسودة'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {quiz.settings?.use_question_bank
                        ? `${quiz.settings.questions_per_user || 0} لكل مستخدم`
                        : `${questions.length} أسئلة`
                      }
                    </p>
                    <p className="text-sm text-slate-600">
                      {quiz.settings?.use_question_bank ? 'من بنك الأسئلة' : 'أسئلة ثابتة'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-lg">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Clock className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {quiz.settings?.time_limit ? `${quiz.settings.time_limit} دقيقة` : 'بدون حد زمني'}
                    </p>
                    <p className="text-sm text-slate-600">الوقت المحدد</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Settings className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">
                      {quiz.settings?.require_password ? 'محمي بكلمة مرور' : 'مفتوح'}
                    </p>
                    <p className="text-sm text-slate-600">الوصول</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings Overview */}
          <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                إعدادات الاختبار
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">عرض النتائج</span>
                    <Badge variant={quiz.settings?.show_results ? 'default' : 'secondary'}>
                      {quiz.settings?.show_results ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">خلط الأسئلة</span>
                    <Badge variant={quiz.settings?.shuffle_questions ? 'default' : 'secondary'}>
                      {quiz.settings?.shuffle_questions ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">السماح بالإعادة</span>
                    <Badge variant={quiz.settings?.allow_retakes ? 'default' : 'secondary'}>
                      {quiz.settings?.allow_retakes ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">حماية بكلمة مرور</span>
                    <Badge variant={quiz.settings?.require_password ? 'default' : 'secondary'}>
                      {quiz.settings?.require_password ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">منع الإدخال المتكرر (الهوية)</span>
                    <Badge variant={quiz.settings?.restrict_by_id ? 'default' : 'secondary'}>
                      {quiz.settings?.restrict_by_id ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">منع الإدخال المتكرر (IP)</span>
                    <Badge variant={quiz.settings?.restrict_by_ip ? 'default' : 'secondary'}>
                      {quiz.settings?.restrict_by_ip ? 'نعم' : 'لا'}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Questions Preview */}
          {quiz.settings?.use_question_bank ? (
            <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
              <CardHeader>
                <CardTitle>معاينة بنك الأسئلة</CardTitle>
                <p className="text-slate-600">
                  هذا الاختبار يستخدم بنك الأسئلة. سيحصل كل مستخدم على {quiz.settings.questions_per_user || 'عدد محدد من'} أسئلة عشوائية.
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {questions.length > 0 ? (
                    <>
                      {questions.slice(0, 3).map((question, index) => (
                        <div key={index} className="p-4 border border-slate-200 rounded-lg">
                          <div className="flex items-start gap-3 mb-2">
                            <div className="p-2 bg-slate-100 rounded-lg flex-shrink-0">
                              {getQuestionIcon(question.type)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {getQuestionTypeLabel(question.type)}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {question.difficulty || 'متوسط'}
                                </Badge>
                              </div>
                              <h4 className="font-medium text-slate-900">{question.question}</h4>
                              {question.options && question.options.length > 0 && (
                                <div className="mt-2 space-y-1">
                                  {question.options.slice(0, 2).map((option, optionIndex) => (
                                    <p key={optionIndex} className="text-sm text-slate-600 ml-4">
                                      • {option}
                                    </p>
                                  ))}
                                  {question.options.length > 2 && (
                                    <p className="text-sm text-slate-500 ml-4">
                                      ... و {question.options.length - 2} خيارات أخرى
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      {questions.length > 3 && (
                        <div className="text-center p-4 bg-slate-50 rounded-lg">
                          <p className="text-slate-600">
                            و {questions.length - 3} أسئلة أخرى من بنك الأسئلة...
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                      <p className="text-slate-500">لا توجد أسئلة متوفرة في بنك الأسئلة بالمعايير المحددة.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <Card className="bg-white/80 backdrop-blur-sm border-slate-200/60">
                <CardHeader>
                  <CardTitle>معاينة الأسئلة ({questions.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {questions.map((question, index) => (
                      <div key={question.id} className="p-6 border border-slate-200 rounded-lg">
                        <div className="flex items-start gap-4 mb-4">
                          <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
                            {getQuestionIcon(question.type)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">
                                السؤال {index + 1}
                              </Badge>
                              <Badge variant="secondary">
                                {getQuestionTypeLabel(question.type)}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {question.points || 1} نقطة
                              </Badge>
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-3">
                              {question.question}
                            </h3>

                            {question.type === "multiple_choice" && (
                              <div className="space-y-2">
                                {question.options?.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                    <Circle className="w-4 h-4 text-slate-400" />
                                    <span className="text-slate-700">{option}</span>
                                    {question.correct_answers?.includes(option) && (
                                      <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                        إجابة صحيحة
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {question.type === "checkbox" && (
                              <div className="space-y-2">
                                {question.options?.map((option, optionIndex) => (
                                  <div key={optionIndex} className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                    <Square className="w-4 h-4 text-slate-400" />
                                    <span className="text-slate-700">{option}</span>
                                    {question.correct_answers?.includes(option) && (
                                      <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                        إجابة صحيحة
                                      </Badge>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {question.type === "true_false" && (
                              <div className="space-y-2">
                                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                  <Circle className="w-4 h-4 text-slate-400" />
                                  <span className="text-slate-700">صح</span>
                                  {question.correct_answers?.includes("صح") && (
                                    <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                      إجابة صحيحة
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 p-2 bg-slate-50 rounded">
                                  <Circle className="w-4 h-4 text-slate-400" />
                                  <span className="text-slate-700">خطأ</span>
                                  {question.correct_answers?.includes("خطأ") && (
                                    <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                      إجابة صحيحة
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}

                            {question.type === "text" && (
                              <div className="p-3 bg-slate-50 rounded border-2 border-dashed border-slate-300">
                                <p className="text-slate-500 italic">مساحة للإجابة النصية...</p>
                                {question.correct_answers?.length > 0 && (
                                  <div className="mt-2">
                                    <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                      الإجابة النموذجية: {question.correct_answers[0]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            {question.type === "fill_blank" && (
                              <div className="p-3 bg-slate-50 rounded border-2 border-dashed border-slate-300">
                                <p className="text-slate-500 italic">مساحة لإكمال الفراغ...</p>
                                {question.correct_answers?.length > 0 && (
                                  <div className="mt-2">
                                    <Badge variant="default" className="text-xs bg-green-100 text-green-700">
                                      الإجابة الصحيحة: {question.correct_answers[0]}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            )}

                            {question.explanation && (
                              <div className="mt-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-400">
                                <p className="text-sm font-medium text-blue-900 mb-1">شرح:</p>
                                <p className="text-blue-800">{question.explanation}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {questions.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                        <p className="text-slate-500">لا توجد أسئلة في هذا الاختبار بعد.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-center gap-4 pt-6">
            <Link to={createPageUrl("DashboardAR")}>
              <Button variant="outline">العودة إلى لوحة التحكم</Button>
            </Link>
            <Link to={createPageUrl(`QuizBuilderAR?id=${quiz.id}`)}>
              <Button variant="outline">تحرير الاختبار</Button>
            </Link>
            {quiz.status === 'published' && quiz.share_token && (
              <Link to={createPageUrl(`TakeQuizAR?token=${quiz.share_token}`)} target="_blank">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  جرب الاختبار
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
