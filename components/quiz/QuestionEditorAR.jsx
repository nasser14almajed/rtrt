
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  GripVertical,
  Edit,
  Save,
  X,
  Trash2,
  Copy,
  Plus,
  Minus
} from "lucide-react";
import { motion } from "framer-motion";

// Debounce utility function
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(null, args);
    }, delay);
  };
};

export default React.memo(function QuestionEditorAR({
  question,
  index,
  isEditing,
  onEdit,
  onUpdate,
  onSaveAndClose,
  onDelete,
  onDuplicate,
  dragHandleProps,
  isSelectable = false,
  isSelected = false,
  onSelect
}) {
  const [localQuestion, setLocalQuestion] = useState(question);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalQuestion(question);
    setHasChanges(false);
  }, [question]);

  // Debounce the onUpdate call to prevent too frequent updates to the parent state
  // and improve typing performance.
  const debouncedOnUpdate = useCallback(
    debounce((qId, updatedQ) => {
      onUpdate(qId, updatedQ);
      setHasChanges(false); // Reset hasChanges after the actual update is sent
    }, 1000),
    [onUpdate] // Dependency array: recreate debounced function if onUpdate changes
  );

  const handleChange = (field, value) => {
    const updated = { ...localQuestion, [field]: value };
    setLocalQuestion(updated);
    setHasChanges(true); // Indicate changes immediately for UI feedback

    // Trigger the debounced update
    debouncedOnUpdate(question.id, updated);
  };

  const handleSave = () => {
    // When manually saving, ensure the latest local state is passed
    onSaveAndClose(question.id, localQuestion);
    setHasChanges(false);
  };

  const addOption = () => {
    const newOptions = [...(localQuestion.options || []), ""];
    handleChange('options', newOptions);
  };

  const updateOption = (optionIndex, value) => {
    const newOptions = [...localQuestion.options];
    newOptions[optionIndex] = value;
    handleChange('options', newOptions);
  };

  const removeOption = (optionIndex) => {
    const newOptions = localQuestion.options.filter((_, i) => i !== optionIndex);
    const removedOption = localQuestion.options[optionIndex];
    // Also filter correct answers if the removed option was a correct answer
    const newCorrectAnswers = localQuestion.correct_answers.filter(ans => ans !== removedOption);
    
    const updatedQuestion = {
      ...localQuestion,
      options: newOptions,
      correct_answers: newCorrectAnswers
    };
    setLocalQuestion(updatedQuestion);
    setHasChanges(true);
    debouncedOnUpdate(question.id, updatedQuestion); // Trigger debounced save for this compound update
  };

  const toggleCorrectAnswer = (option) => {
    let newCorrectAnswers;
    
    if (localQuestion.type === 'multiple_choice' || localQuestion.type === 'true_false') {
      // Single selection
      newCorrectAnswers = localQuestion.correct_answers.includes(option) ? [] : [option];
    } else {
      // Multiple selection for checkbox
      newCorrectAnswers = localQuestion.correct_answers.includes(option)
        ? localQuestion.correct_answers.filter(ans => ans !== option)
        : [...localQuestion.correct_answers, option];
    }
    
    handleChange('correct_answers', newCorrectAnswers);
  };

  const getTypeLabel = (type) => {
    const types = {
      text: "إجابة نصية",
      multiple_choice: "اختيار متعدد",
      checkbox: "صناديق اختيار",
      true_false: "صح/خطأ",
      fill_blank: "أكمل الفراغ"
    };
    return types[type] || type;
  };

  if (isEditing) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative"
      >
        <Card className="border-2 border-blue-400 shadow-lg">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">السؤال {index + 1}</Badge>
                <Badge variant="outline">{getTypeLabel(localQuestion.type)}</Badge>
                {hasChanges && <Badge className="bg-orange-100 text-orange-800">غير محفوظ</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="w-4 h-4 mr-1" />
                  حفظ
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onEdit(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">نص السؤال</label>
              <Textarea
                value={localQuestion.question}
                onChange={(e) => handleChange('question', e.target.value)}
                placeholder="أدخل سؤالك هنا..."
                className="min-h-[80px]"
              />
            </div>

            {(localQuestion.type === 'multiple_choice' || localQuestion.type === 'checkbox') && (
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-sm font-medium text-slate-700">خيارات الإجابة</label>
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="w-4 h-4 mr-1" />
                    إضافة خيار
                  </Button>
                </div>
                <div className="space-y-2">
                  {localQuestion.options?.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <input
                        type={localQuestion.type === 'multiple_choice' ? 'radio' : 'checkbox'}
                        name={`question-${question.id}`}
                        checked={localQuestion.correct_answers?.includes(option)}
                        onChange={() => toggleCorrectAnswer(option)}
                        className="text-green-600"
                      />
                      <Input
                        value={option}
                        onChange={(e) => updateOption(optionIndex, e.target.value)}
                        placeholder={`الخيار ${optionIndex + 1}`}
                        className="flex-1"
                      />
                      {localQuestion.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOption(optionIndex)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Minus className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {localQuestion.type === 'true_false' && (
              <div>
                <label className="text-sm font-medium text-slate-700 mb-3 block">الإجابة الصحيحة</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${question.id}`}
                      checked={localQuestion.correct_answers?.includes('صح')}
                      onChange={() => handleChange('correct_answers', ['صح'])}
                      className="text-green-600"
                    />
                    <span>صح</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name={`tf-${question.id}`}
                      checked={localQuestion.correct_answers?.includes('خطأ')}
                      onChange={() => handleChange('correct_answers', ['خطأ'])}
                      className="text-green-600"
                    />
                    <span>خطأ</span>
                  </label>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">النقاط</label>
                <Input
                  type="number"
                  min="1"
                  value={localQuestion.points}
                  onChange={(e) => handleChange('points', parseInt(e.target.value) || 1)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-2 block">مطلوب</label>
                <div className="flex items-center space-x-2 h-10">
                  <Checkbox
                    id={`required-${question.id}`}
                    checked={localQuestion.required}
                    onCheckedChange={(checked) => handleChange('required', checked)}
                  />
                  <label htmlFor={`required-${question.id}`} className="text-sm">
                    هذا السؤال مطلوب
                  </label>
                </div>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">الشرح (اختياري)</label>
              <Textarea
                value={localQuestion.explanation || ''}
                onChange={(e) => handleChange('explanation', e.target.value)}
                placeholder="اشرح الإجابة الصحيحة أو قدم ملاحظات إضافية..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <Card className={`group hover:shadow-md transition-all duration-200 ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'bg-white'}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!isSelectable && (
              <div {...dragHandleProps} className="cursor-grab active:cursor-grabbing">
                <GripVertical className="w-4 h-4 text-slate-400" />
              </div>
            )}
            {isSelectable && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => onSelect(question.id)}
              />
            )}
            <div className="flex items-center gap-2">
              <Badge variant="secondary">السؤال {index + 1}</Badge>
              <Badge variant="outline">{getTypeLabel(question.type)}</Badge>
              <Badge variant="outline">{question.points} نقطة</Badge>
            </div>
          </div>
          {!isSelectable && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" onClick={() => onEdit(question.id)}>
                <Edit className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => onDuplicate(question)}>
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(question.id)}
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <p className="text-slate-900 font-medium leading-relaxed">
            {question.question || 'سؤال فارغ - اضغط للتعديل'}
          </p>
          
          {question.options && question.options.length > 0 && (
            <div className="space-y-2">
              {question.options.map((option, optionIndex) => (
                <div
                  key={optionIndex}
                  className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                    question.correct_answers?.includes(option)
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    question.correct_answers?.includes(option)
                      ? 'bg-green-500 border-green-500'
                      : 'border-slate-300'
                  }`}>
                    {question.correct_answers?.includes(option) && (
                      <span className="block w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></span>
                    )}
                  </span>
                  <span>{option}</span>
                </div>
              ))}
            </div>
          )}

          {question.type === 'true_false' && (
            <div className="flex gap-4">
              {['صح', 'خطأ'].map((option) => (
                <div
                  key={option}
                  className={`flex items-center gap-2 text-sm p-2 rounded-md ${
                    question.correct_answers?.includes(option)
                      ? 'bg-green-50 text-green-800 border border-green-200'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                    question.correct_answers?.includes(option)
                      ? 'bg-green-500 border-green-500'
                      : 'border-slate-300'
                  }`}>
                    {question.correct_answers?.includes(option) && (
                      <span className="block w-2 h-2 bg-white rounded-full mx-auto mt-0.5"></span>
                    )}
                  </span>
                  <span>{option}</span>
                </div>
              ))}
            </div>
          )}

          {question.explanation && (
            <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>الشرح:</strong> {question.explanation}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
