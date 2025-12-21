import React, { useState, useEffect } from 'react';
import { base44 } from '../api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Shield, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export default function PublicSurvey() {
  const [templateId, setTemplateId] = useState(null);
  const [step, setStep] = useState(1);
  const [responses, setResponses] = useState({});
  const [submitterName, setSubmitterName] = useState('');
  const [submitterEmail, setSubmitterEmail] = useState('');
  const [submitterPhone, setSubmitterPhone] = useState('');
  const [selectedGuardId, setSelectedGuardId] = useState('');
  const [selectedGuardName, setSelectedGuardName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) setTemplateId(id);
  }, []);

  const { data: template, isLoading, error } = useQuery({
    queryKey: ['publicTemplate', templateId],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.ReportTemplate.get(templateId);
      } catch (err) {
        console.error('Error loading template:', err);
        return null;
      }
    },
    enabled: !!templateId,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { data: guards = [] } = useQuery({
    queryKey: ['guards'],
    queryFn: async () => {
      try {
        return await base44.asServiceRole.entities.Guard.list();
      } catch (err) {
        console.error('Error loading guards:', err);
        return [];
      }
    },
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const submitReport = useMutation({
    mutationFn: (data) => base44.asServiceRole.entities.ReportSubmission.create(data),
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const handleNext = () => {
    const newErrors = {};
    if (step === 1) {
      if (!submitterName) newErrors.submitterName = 'Full Name is required';
      if (!submitterEmail) newErrors.submitterEmail = 'Email is required';

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
      setErrors({});
      setStep(2);
    } else if (step === 2) {
      if (!selectedGuardId) {
        newErrors.selectedGuardId = 'Please select a guard';
        setErrors(newErrors);
        return;
      }
      setErrors({});
      setStep(3);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = {};

    template?.questions?.forEach((q) => {
      if (q.required && !responses[q.id]) {
        newErrors[q.id] = 'This field is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Auto-grade responses
    let totalScore = 0;
    let totalPoints = 0;
    const responsesArray = template.questions.map((q) => {
      const answer = responses[q.id] || '';
      const points = q.points || 1;
      totalPoints += points;

      let isCorrect = false;
      let pointsEarned = 0;

      if (q.correct_answer) {
        if (q.type === 'multiple_choice' || q.type === 'text') {
          isCorrect = answer.toLowerCase().trim() === q.correct_answer.toLowerCase().trim();
        } else if (q.type === 'checkbox') {
          const submittedAnswers = Array.isArray(answer) ? answer.map(a => a.toLowerCase().trim()) : [answer.toLowerCase().trim()];
          const correctAnswers = q.correct_answer.split(',').map(a => a.toLowerCase().trim());
          isCorrect = submittedAnswers.length === correctAnswers.length && submittedAnswers.every(a => correctAnswers.includes(a));
        }

        if (isCorrect) {
          pointsEarned = points;
          totalScore += points;
        }
      }

      return {
        question_id: q.id,
        question: q.question,
        answer: Array.isArray(answer) ? answer.join(', ') : answer,
        is_correct: isCorrect,
        points_earned: pointsEarned,
      };
    });

    const percentage = totalPoints > 0 ? Math.round((totalScore / totalPoints) * 100) : 0;
    const passed = percentage >= (template.passing_score || 70);

    submitReport.mutate({
      template_id: template.id,
      template_title: template.title,
      site_id: template.site_id,
      site_name: template.site_name,
      responses: responsesArray,
      score: totalScore,
      total_points: totalPoints,
      percentage: percentage,
      passed: passed,
      review_status: 'pending',
      submitted_by: submitterName || 'Anonymous',
      submitter_email: submitterEmail,
      submitter_phone: submitterPhone,
      guard_id: selectedGuardId,
      guard_name: selectedGuardName,
      submitted_at: new Date().toISOString(),
    });
  };

  const renderQuestion = (question) => {
    const value = responses[question.id] || '';
    const error = errors[question.id];

    switch (question.type) {
      case 'text':
        return (
          <Input
            value={value}
            onChange={(e) => {
              setResponses({ ...responses, [question.id]: e.target.value });
              setErrors({ ...errors, [question.id]: null });
            }}
            className="border-slate-300"
            placeholder="Enter your answer"
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={value}
            onChange={(e) => {
              setResponses({ ...responses, [question.id]: e.target.value });
              setErrors({ ...errors, [question.id]: null });
            }}
            className="border-slate-300 min-h-24"
            placeholder="Enter your answer"
          />
        );

      case 'multiple_choice':
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <label key={option} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name={question.id}
                  value={option}
                  checked={value === option}
                  onChange={(e) => {
                    setResponses({ ...responses, [question.id]: e.target.value });
                    setErrors({ ...errors, [question.id]: null });
                  }}
                  className="w-4 h-4"
                />
                <span className="text-slate-700">{option}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options?.map((option) => {
              const checked = value.includes(option);
              return (
                <label key={option} className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const current = Array.isArray(value) ? value : [];
                      const updated = e.target.checked
                        ? [...current, option]
                        : current.filter((v) => v !== option);
                      setResponses({ ...responses, [question.id]: updated });
                      setErrors({ ...errors, [question.id]: null });
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-slate-700">{option}</span>
                </label>
              );
            })}
          </div>
        );

      default:
        return null;
    }
  };

  if (!templateId) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 mx-auto text-red-600 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Invalid Link</h2>
          <p className="text-slate-600 mt-2">Please scan a valid QR code to access the form.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="text-slate-600">Loading form...</div>
      </div>
    );
  }

  if (!template) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-lg">
          <AlertCircle className="w-16 h-16 mx-auto text-red-600 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Form Not Found</h2>
          <p className="text-slate-600 mt-2">The requested form could not be found or is no longer available.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="bg-white rounded-lg p-8 max-w-md text-center shadow-lg">
          <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
          <h2 className="text-xl font-bold text-slate-900">Submission Received</h2>
          <p className="text-slate-600 mt-2">Thank you for completing this inspection report.</p>
          <p className="text-sm text-slate-500 mt-4">Your response has been recorded securely.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="bg-gradient-to-r from-slate-800 to-slate-700 text-white py-6 border-b-4 border-slate-900">
        <div className="max-w-4xl mx-auto px-6">
          <div className="flex items-center gap-3">
            <Shield className="w-8 h-8" />
            <div>
              <h1 className="text-2xl font-bold">Official Inspection Report</h1>
              <p className="text-slate-300 text-sm">Kingdom of Bahrain - Security Services</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="bg-white rounded-lg shadow-lg">
          <div className="border-b border-slate-200 p-8">
            <h2 className="text-2xl font-bold text-slate-900">{template.title}</h2>
            {template.description && (
              <p className="text-slate-600 mt-2">{template.description}</p>
            )}
            {template.site_name && (
              <div className="mt-4 inline-block bg-slate-100 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium text-slate-700">Site: {template.site_name}</span>
              </div>
            )}
          </div>

          <div className="p-8">
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 1 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  1
                </div>
                <div className={`w-16 h-1 ${step >= 2 ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 2 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  2
                </div>
                <div className={`w-16 h-1 ${step >= 3 ? 'bg-slate-800' : 'bg-slate-200'}`} />
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${step >= 3 ? 'bg-slate-800 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  3
                </div>
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-6">Your Details</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <Input
                    value={submitterName}
                    onChange={(e) => setSubmitterName(e.target.value)}
                    className="border-slate-300"
                    placeholder="Enter your full name"
                  />
                  {errors.submitterName && <p className="text-red-600 text-sm mt-1">{errors.submitterName}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email <span className="text-red-600">*</span>
                  </label>
                  <Input
                    type="email"
                    value={submitterEmail}
                    onChange={(e) => setSubmitterEmail(e.target.value)}
                    className="border-slate-300"
                    placeholder="Enter your email"
                  />
                  {errors.submitterEmail && <p className="text-red-600 text-sm mt-1">{errors.submitterEmail}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Phone Number
                  </label>
                  <Input
                    type="tel"
                    value={submitterPhone}
                    onChange={(e) => setSubmitterPhone(e.target.value)}
                    className="border-slate-300"
                    placeholder="Enter your phone number"
                  />
                </div>
                <Button
                  onClick={handleNext}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white py-6 text-lg font-semibold"
                >
                  Next <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <h3 className="text-xl font-semibold text-slate-900 mb-6">Select Guard</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Guard <span className="text-red-600">*</span>
                  </label>
                  <Select
                    value={selectedGuardId}
                    onValueChange={(value) => {
                      setSelectedGuardId(value);
                      const guard = guards.find(g => g.id === value);
                      setSelectedGuardName(guard?.name || '');
                    }}
                  >
                    <SelectTrigger className="border-slate-300">
                      <SelectValue placeholder="Select a guard" />
                    </SelectTrigger>
                    <SelectContent>
                      {guards.map((guard) => (
                        <SelectItem key={guard.id} value={guard.id}>
                          {guard.name} - {guard.employee_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.selectedGuardId && <p className="text-red-600 text-sm mt-1">{errors.selectedGuardId}</p>}
                </div>
                {selectedGuardId && (
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <p className="text-sm text-slate-600">Selected Guard:</p>
                    <p className="font-semibold text-slate-900">{selectedGuardName}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1 py-6 text-lg font-semibold"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" /> Back
                  </Button>
                  <Button
                    onClick={handleNext}
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-6 text-lg font-semibold"
                  >
                    Next <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <form onSubmit={handleSubmit} className="space-y-8">
                <h3 className="text-xl font-semibold text-slate-900 mb-6">Inspection Questions</h3>
                {template.questions?.map((question, index) => (
                  <div key={question.id} className="border-l-4 border-slate-300 pl-6 py-2">
                    <label className="block text-sm font-medium text-slate-900 mb-3">
                      {index + 1}. {question.question}
                      {question.required && <span className="text-red-600 ml-1">*</span>}
                    </label>
                    {renderQuestion(question)}
                    {errors[question.id] && (
                      <p className="text-red-600 text-sm mt-2">{errors[question.id]}</p>
                    )}
                  </div>
                ))}

                <div className="pt-6 border-t border-slate-200 flex gap-3">
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    className="flex-1 py-6 text-lg font-semibold"
                  >
                    <ArrowLeft className="w-5 h-5 mr-2" /> Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitReport.isPending}
                    className="flex-1 bg-slate-800 hover:bg-slate-900 text-white py-6 text-lg font-semibold"
                  >
                    {submitReport.isPending ? 'Submitting...' : 'Submit Report'}
                  </Button>
                </div>
              </form>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 text-center">
            <p className="text-xs text-slate-500">
              This form is part of the official security monitoring system.
              <br />
              All submissions are recorded and reviewed by authorized personnel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
