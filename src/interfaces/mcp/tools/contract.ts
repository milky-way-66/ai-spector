import type { z } from "zod";
import type {
  ContractReviewSchema,
  ContractCommentsSchema,
  ContractPrototypeSchema,
  ContractTranslateSchema,
} from "../schemas.js";
import {
  dispatchContractReview,
  dispatchContractComments,
  dispatchContractPrototype,
  dispatchContractTranslate,
} from "@/core/operations/contract.js";

export async function toolContractReview(input: z.infer<typeof ContractReviewSchema>) {
  return dispatchContractReview(input);
}

export async function toolContractComments(input: z.infer<typeof ContractCommentsSchema>) {
  return dispatchContractComments(input);
}

export async function toolContractPrototype(input: z.infer<typeof ContractPrototypeSchema>) {
  return dispatchContractPrototype(input);
}

export async function toolContractTranslate(input: z.infer<typeof ContractTranslateSchema>) {
  return dispatchContractTranslate(input);
}
