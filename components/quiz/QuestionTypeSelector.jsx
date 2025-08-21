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
    label: "Text Answer",
    description: "Open-ended text response",
    icon: Type
  },
  {
    type: "multiple_choice",
    label: "Multiple Choice",
    description: "Single correct answer",
    icon: ListChecks
  },
  {
    type: "checkbox",
    label: "Checkboxes",
    description: "Multiple correct answers",
    icon: CheckSquare
  },
  {
    type: "true_false",
    label: "True/False",
    description: "Simple true or false",
    icon: ToggleLeft
  },
  {
    type: "fill_blank",
    label: "Fill in the Blank",
    description: "Complete the sentence",
    icon: FileText
  }
];

export default function QuestionTypeSelector({ onSelect }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Plus className="w-4 h-4" />
          Add Question
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