export type RoleId =
  | "searcher"
  | "analyzer"
  | "summarizer"
  | "sender"
  | "planner"
  | "executor"
  | "qa"
  | "deployer"
  | "marketing";

export type OfficeType = "research" | "developer";

export interface RoleDef {
  id: RoleId;
  name: string;
  office: OfficeType;
  description: string;
  color: string;
  emissive: string;
}

export const ROLES: Record<RoleId, RoleDef> = {
  searcher: {
    id: "searcher",
    name: "Searcher",
    office: "research",
    description: "Finds and collects sources",
    color: "#4ad6ff",
    emissive: "#4ad6ff",
  },
  analyzer: {
    id: "analyzer",
    name: "Analyzer",
    office: "research",
    description: "Reviews quality and flags weak sources",
    color: "#8a7bff",
    emissive: "#8a7bff",
  },
  summarizer: {
    id: "summarizer",
    name: "Summarizer",
    office: "research",
    description: "Creates concise research summary",
    color: "#43e3a4",
    emissive: "#43e3a4",
  },
  sender: {
    id: "sender",
    name: "Sender",
    office: "research",
    description: "Formats citations and delivers results",
    color: "#ffb547",
    emissive: "#ffb547",
  },
  planner: {
    id: "planner",
    name: "Planner",
    office: "developer",
    description: "Converts ideas into development plans",
    color: "#4ad6ff",
    emissive: "#4ad6ff",
  },
  executor: {
    id: "executor",
    name: "Executor",
    office: "developer",
    description: "Generates code and builds functionality",
    color: "#8a7bff",
    emissive: "#8a7bff",
  },
  qa: {
    id: "qa",
    name: "QA Engineer",
    office: "developer",
    description: "Reviews code and requests fixes",
    color: "#ff5bd1",
    emissive: "#ff5bd1",
  },
  deployer: {
    id: "deployer",
    name: "Deployer",
    office: "developer",
    description: "Creates deployment checklist",
    color: "#43e3a4",
    emissive: "#43e3a4",
  },
  marketing: {
    id: "marketing",
    name: "Marketing",
    office: "developer",
    description: "Generates launch content",
    color: "#ffb547",
    emissive: "#ffb547",
  },
};

export const ROLE_LIST: RoleDef[] = Object.values(ROLES);
