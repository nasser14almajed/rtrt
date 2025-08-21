import React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Plus, 
  Type, 
  ListChecks, 
  CheckSquare, 
  ToggleLeft,
  FileText
} from "lucide-react";

const questionTypes = [
  {
    type: "text",
    label: "إجابة نصية",
    description: "استجابة نصية مفتوحة",
    icon: Type
  },
  {
    type: "multiple_choice",
    label: "اختيار متعدد",
    description: "إجابة واحدة صحيحة",
    icon: ListChecks
  },
  {
    type: "checkbox",
    label: "صناديق اختيار",
    description: "إجابات متعددة صحيحة",
    icon: CheckSquare
  },
  {
    type: "true_false",
    label: "صح/خطأ",
    description: "صح أو خطأ بسيط",
    icon: ToggleLeft
  },
  {
    type: "fill_blank",
    label: "أكمل الفراغ",
    description: "أكمل الجملة",
    icon: FileText
  }
];

export default function QuestionTypeSelectorAR({ onSelect }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" />
          إضافة سؤال
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        {questionTypes.map((type) => (
          <DropdownMenuItem
            key={type.type}
            onClick={() => onSelect(type.type)}
            className="flex items-start gap-3 p-3 cursor-pointer"
          >
            <div className="p-2 bg-slate-100 rounded-lg">
              <type.icon className="w-4 h-4" />
            </div>
            <div>
              <p className="font-medium text-sm">{type.label}</p>
              <p className="text-xs text-slate-500">{type.description}</p>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}