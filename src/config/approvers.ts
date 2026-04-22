export const APPROVERS = [
  { key: "tanja", displayName: "Tanja", email: "tanja@li.finance" },
  { key: "maegan", displayName: "Maegan", email: "maegan@li.finance" },
  { key: "alina", displayName: "Alina", email: "alina@li.finance" },
] as const;

export type ApproverKey = (typeof APPROVERS)[number]["key"];

export function approverByKey(key: string) {
  return APPROVERS.find((a) => a.key === key);
}
