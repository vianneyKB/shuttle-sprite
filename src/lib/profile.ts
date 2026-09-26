import { z } from "zod";

/**
 * Profile rules, kept out of the components so the number a passenger types at
 * sign-up, on the profile page and in the ride sheet is checked the same way in
 * all three places.
 *
 * Numbers are stored exactly as typed: South African mobile numbers are written
 * as 082 123 4567, +27 82 123 4567 or (082) 123-4567, and the driver dials what
 * the passenger gave. Normalising them is a separate job from capturing them.
 */
export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/;

export const isValidPhone = (value: string) => PHONE_PATTERN.test(value.trim());

export const profileFormSchema = z.object({
  displayName: z.string().trim().min(2, "Enter your name").max(80),
  phone: z.string().trim().regex(PHONE_PATTERN, "Enter a valid mobile number"),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

type ProfileContact = { displayName: string; phone: string };

/**
 * The fields that actually differ, trimmed. `profiles` has an `updated_at`
 * trigger, so saving an untouched form would still write a row — this lets the
 * page skip the request instead.
 */
export const profileChanges = (
  current: ProfileContact,
  next: ProfileFormValues
): Partial<ProfileFormValues> => {
  const changes: Partial<ProfileFormValues> = {};
  const displayName = next.displayName.trim();
  const phone = next.phone.trim();
  if (displayName !== current.displayName.trim()) changes.displayName = displayName;
  if (phone !== current.phone.trim()) changes.phone = phone;
  return changes;
};
