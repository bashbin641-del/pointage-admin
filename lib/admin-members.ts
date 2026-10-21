export type AdministratorMember = {
  userId: string;
  email: string;
  displayName: string;
  matricule: string;
  hiredAt: string;
  role: "owner" | "administrator" | "maintainer";
  status: "active" | "pending" | "blocked";
  createdAt: string;
};
