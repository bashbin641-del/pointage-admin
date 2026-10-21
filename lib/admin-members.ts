export type AdministratorMember = {
  userId: string;
  email: string;
  displayName: string;
  matricule: string;
  role: "owner" | "administrator";
  status: "active" | "pending" | "blocked";
  createdAt: string;
};
