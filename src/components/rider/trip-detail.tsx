"use client";

import * as React from "react";
import Image from "next/image";
import { AlertTriangle, Check, FileWarning, Receipt, Star } from "lucide-react";
import type { Trip } from "@/types";
import { api, errorMessage } from "@/lib/api";
import { COMPLAINT_CATEGORIES, TRIP_STATUS_META, VEHICLE_IMAGES } from "@/lib/constants";
import { cn, formatDateTime, formatKm, formatLKR, formatMinutes, formatTime } from "@/lib/utils";
import { MapView } from "@/components/map";
import { Avatar, Badge, Card, RatingInline, RatingStars, TopBar } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { BottomSheet } from "@/components/ui/sheet";
import { Select, Textarea } from "@/components/ui/field";
import { FullScreenLoader } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { FareBreakdownList, PaymentMethodRow, TripRoute } from "./ride-bits";

export function TripDetail({ tripId, perspective, backHref, userId }: { tripId: string; perspective: "rider" | "driver"; backHref: string; userId: string }) {
  const [trip, setTrip] = React.useState<Trip | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [complaintOpen, setComplaintOpen] = React.useState(false);
  const [disputeOpen, setDisputeOpen] = React.useState(false);
  const [stars, setStars] = React.useState(0);

  React.useEffect(() => {
    api.trips
      .get(tripId)
      .then((t) => {
        setTrip(t);
        setStars(t.myRating ?? 0);
      })
      .catch((e) => setError(errorMessage(e, "Trip not found")));
  }, [tripId]);

  if (error) {
    return (
      <div className="flex h-full flex-col">
        <TopBar back={backHref} title="Trip" />
        <div className="p-6 text-center text-sm text-muted">{error}</div>
      </div>
    );
  }
  if (!trip) return <FullScreenLoader label="Loading trip…" />;

  const meta = TRIP_STATUS_META[trip.status];
  const other = perspective === "rider" ? trip.driver : trip.rider;
  const p = trip.payment;
  const timeline = [
    { label: "Requested", at: trip.requestedAt },
    { label: "Driver matched", at: trip.matchedAt },
    { label: "Driver arrived", at: trip.arrivedAt },
    { label: "Trip started", at: trip.startedAt },
    { label: "Completed", at: trip.completedAt },
    ...(trip.status === "CANCELLED" ? [{ label: `Cancelled by ${trip.cancelledBy?.toLowerCase() ?? "system"}`, at: trip.completedAt ?? trip.requestedAt }] : []),
  ].filter((x) => x.at);

  return (
    <div className="flex flex-col">
      <TopBar back={backHref} title="Trip details" subtitle={formatDateTime(trip.requestedAt ?? trip.createdAt)} right={<Badge tone={meta.tone}>{meta.label}</Badge>} />
      <div className="mx-auto w-full max-w-[720px]">
        <div className="h-56 overflow-hidden rounded-2xl border border-zinc-200/80 sm:h-72">
          <MapView fitTo={[trip.pickup, trip.destination]} route={trip.routeGeometry} pickup={trip.pickup} destination={trip.destination} interactive={false} fitPadding={[30, 24]} routeTone="muted" />
        </div>

        <div className="space-y-3 pt-4">
          <Card>
            <TripRoute trip={trip} />
            <div className="mt-2 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs">
              <span className="text-muted">
                {formatKm(trip.distanceKm)} · {formatMinutes(trip.durationMin)}
              </span>
              <span className="inline-flex items-center gap-2">
                <Image src={VEHICLE_IMAGES[trip.vehicleTypeCode]} alt="" width={40} height={26} className="h-5 w-8 object-contain mix-blend-multiply" />
                <span className="font-semibold">{trip.vehicleTypeCode === "TUK" ? "Tuk" : trip.vehicleTypeCode === "XL" ? "XL Van" : trip.vehicleTypeCode === "BIKE" ? "Bike" : "Car"}</span>
              </span>
            </div>
          </Card>

          {other && (
            <Card className="flex items-center gap-3">
              <Avatar name={other.name} src={other.photoUrl} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{other.name}</p>
                <RatingInline value={other.rating} />
              </div>
              {perspective === "rider" && trip.driver && (
                <div className="text-right">
                  <p className="text-sm font-bold">{trip.driver.vehiclePlate}</p>
                  <p className="text-[11px] text-muted">
                    {trip.driver.vehicleColor} {trip.driver.vehicleMake} {trip.driver.vehicleModel}
                  </p>
                </div>
              )}
            </Card>
          )}

          <Card>
            <div className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Receipt size={16} /> {p ? "Receipt" : "Fare"}
              </h3>
              {p?.receiptNo && <span className="text-[11px] font-semibold text-muted">{p.receiptNo}</span>}
            </div>
            {p ? (
              <>
                <FareBreakdownList payment={p} className="mt-3" />
                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-3">
                  <PaymentMethodRow method={p.method} />
                  <Badge tone={p.status === "Paid" ? "success" : p.status === "Failed" ? "danger" : "warning"}>{p.status === "AwaitingCash" ? "Awaiting cash" : p.status}</Badge>
                </div>
                {p.processedAt && <p className="mt-1 text-[11px] text-muted">Processed {formatDateTime(p.processedAt)}</p>}
              </>
            ) : (
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-muted">Estimated fare</span>
                <span className="font-semibold">{formatLKR(trip.estimatedFare)}</span>
              </div>
            )}
            {trip.status === "CANCELLED" && (
              <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-xs">
                <p className="font-semibold">Cancelled{trip.cancelledBy ? ` by ${trip.cancelledBy.toLowerCase()}` : ""}</p>
                {trip.cancellationReason && <p className="text-muted">{trip.cancellationReason}</p>}
                <p className="mt-1 font-semibold">{trip.cancellationFee ? `Fee ${formatLKR(trip.cancellationFee)}` : "No fee charged"}</p>
              </div>
            )}
          </Card>

          {timeline.length > 0 && (
            <Card>
              <h3 className="text-sm font-semibold">Timeline</h3>
              <ol className="mt-3 space-y-2">
                {timeline.map((t, i) => (
                  <li key={t.label} className="flex items-center gap-3 text-xs">
                    <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", i === timeline.length - 1 ? "bg-ink text-white" : "bg-brand-100 text-brand-800")}>
                      <Check size={12} strokeWidth={3} />
                    </span>
                    <span className="flex-1 font-medium">{t.label}</span>
                    <span className="text-muted">{formatTime(t.at!)}</span>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          {perspective === "rider" && trip.driver && (trip.status === "PAID" || trip.status === "CLOSED") && (
            <Card>
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold">
                <Star size={16} /> {trip.myRating ? "Your rating" : "Rate this trip"}
              </h3>
              <div className="mt-2 flex items-center justify-between">
                <RatingStars value={stars} onChange={trip.myRating ? undefined : setStars} readOnly={!!trip.myRating} size={26} />
                {!trip.myRating && stars > 0 && (
                  <Button
                    size="sm"
                    full={false}
                    onClick={async () => {
                      await api.trips.rate(trip.id, userId, stars);
                      setTrip({ ...trip, myRating: stars });
                      toast.success("Thanks for rating!");
                    }}
                  >
                    Submit
                  </Button>
                )}
              </div>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button variant="secondary" size="md" leftIcon={<FileWarning size={16} />} onClick={() => setComplaintOpen(true)} className="text-xs">
              File a complaint
            </Button>
            <Button variant="secondary" size="md" leftIcon={<AlertTriangle size={16} />} onClick={() => setDisputeOpen(true)} disabled={!p} className="text-xs">
              Payment issue
            </Button>
          </div>
        </div>
      </div>

      <BottomSheet open={complaintOpen} onClose={() => setComplaintOpen(false)} backdrop>
        <ComplaintForm
          onSubmit={async (category, details) => {
            await api.trips.fileComplaint(trip.id, userId, category, details);
            setComplaintOpen(false);
            toast.success("Complaint filed", "Our team will review it and get back to you.");
          }}
          onClose={() => setComplaintOpen(false)}
        />
      </BottomSheet>
      <BottomSheet open={disputeOpen} onClose={() => setDisputeOpen(false)} backdrop>
        <DisputeForm
          amount={p?.finalFare ?? 0}
          onSubmit={async (reason) => {
            await api.payments.dispute(trip.id, userId, reason);
            setDisputeOpen(false);
            toast.success("Dispute opened", "An admin will review the payment record.");
          }}
          onClose={() => setDisputeOpen(false)}
        />
      </BottomSheet>
    </div>
  );
}

export function ComplaintForm({ onSubmit, onClose }: { onSubmit: (category: string, details: string) => Promise<void>; onClose: () => void }) {
  const [category, setCategory] = React.useState(COMPLAINT_CATEGORIES[0]);
  const [details, setDetails] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">File a complaint</h2>
      <Select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} options={COMPLAINT_CATEGORIES.map((c) => ({ value: c, label: c }))} />
      <Textarea label="What happened?" placeholder="Describe the issue (at least 10 characters)" value={details} onChange={(e) => setDetails(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          loading={busy}
          disabled={details.trim().length < 10}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(category, details.trim());
            } catch (e) {
              toast.error("Couldn't file complaint", errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Submit
        </Button>
      </div>
    </div>
  );
}

export function DisputeForm({ amount, onSubmit, onClose }: { amount: number; onSubmit: (reason: string) => Promise<void>; onClose: () => void }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Report a payment issue</h2>
      <p className="text-xs text-muted">Disagree with the {formatLKR(amount)} charged or the cash recorded for this trip? Tell us what happened and an admin will investigate.</p>
      <Textarea label="Details" placeholder="e.g. I paid Rs 500 cash but the driver says otherwise" value={reason} onChange={(e) => setReason(e.target.value)} />
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button
          loading={busy}
          disabled={reason.trim().length < 10}
          onClick={async () => {
            setBusy(true);
            try {
              await onSubmit(reason.trim());
            } catch (e) {
              toast.error("Couldn't open dispute", errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Open dispute
        </Button>
      </div>
    </div>
  );
}
