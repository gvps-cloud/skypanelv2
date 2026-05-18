import {
	AlertTriangle,
	CheckCircle2,
	Edit2,
	HardDrive,
	Key,
	Loader2,
	Monitor,
	Plus,
	RefreshCw,
	Trash2,
	X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmationDialog } from "@/components/admin/ConfirmationDialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { apiClient } from "@/lib/api";

interface Disk {
	id: number;
	label: string;
	status: string;
	size: number;
	filesystem: string;
	created: string;
	updated: string;
}

interface VPSDisksTabProps {
	instanceId?: string;
	instanceLabel?: string;
	instanceStatus?: string;
	totalDiskAllocation?: number;
	bootDiskId?: number | null;
}

type OrchestrationPhase =
	| "idle"
	| "shutting-down"
	| "resizing"
	| "creating"
	| "booting";

export default function VPSDisksTab({
	instanceId,
	instanceLabel,
	instanceStatus,
	totalDiskAllocation,
	bootDiskId: propBootDiskId,
}: VPSDisksTabProps) {
	const [disks, setDisks] = useState<Disk[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [actionLoading, setActionLoading] = useState<number | null>(null);
	const [apiBootDiskId, setApiBootDiskId] = useState<number | null>(null);
	const [localBootDiskId, setLocalBootDiskId] = useState<number | null>(null);
	const [confirmOsDiskId, setConfirmOsDiskId] = useState<number | null>(null);
	const [osDiskSaving, setOsDiskSaving] = useState(false);

	const effectiveBootDiskId = useMemo(
		() => localBootDiskId ?? apiBootDiskId ?? propBootDiskId ?? null,
		[localBootDiskId, apiBootDiskId, propBootDiskId],
	);

	// Resize dialog state
	const [resizeDialog, setResizeDialog] = useState<{
		open: boolean;
		diskId: number | null;
		diskLabel: string;
		currentSize: number;
	}>({ open: false, diskId: null, diskLabel: "", currentSize: 0 });
	const [resizeSize, setResizeSize] = useState("");
	const [resizePhase, setResizePhase] = useState<OrchestrationPhase>("idle");

	// Create disk dialog state
	const [createDialog, setCreateDialog] = useState<{
		open: boolean;
		label: string;
		filesystem: string;
		size: string;
	}>({ open: false, label: "", filesystem: "ext4", size: "" });
	const [createPhase, setCreatePhase] = useState<OrchestrationPhase>("idle");

	// Delete confirmation state
	const [deleteConfirm, setDeleteConfirm] = useState<{
		open: boolean;
		diskId: number;
		diskLabel: string;
	}>({ open: false, diskId: 0, diskLabel: "" });

	const usedSpace = useMemo(
		() => disks.reduce((sum, d) => sum + d.size, 0),
		[disks],
	);
	const unallocatedSpace = totalDiskAllocation
		? totalDiskAllocation - usedSpace
		: 0;
	const isRunning = instanceStatus === "running";
	const isOrchestrating = resizePhase !== "idle" || createPhase !== "idle";

	// eslint-disable-next-line react-hooks/exhaustive-deps
	const loadDisks = useCallback(async () => {
		if (!instanceId) return;
		setLoading(true);
		setError(null);
		try {
			const data = await apiClient.get<{
				disks: Disk[];
				bootDiskId?: number | null;
			}>(`/vps/${instanceId}/disks`);
			setDisks(data.disks ?? []);
			if (data.bootDiskId !== undefined) {
				setApiBootDiskId(data.bootDiskId);
				if (localBootDiskId === null) {
					setLocalBootDiskId(data.bootDiskId);
				}
			}
		} catch (err) {
			const message =
				err instanceof Error ? err.message : "Failed to load disks";
			setError(message);
		} finally {
			setLoading(false);
		}
	}, [instanceId]);

	useEffect(() => {
		loadDisks();
	}, [loadDisks]);

	const pollInstanceStatus = useCallback(
		async (targetStatus: string): Promise<void> => {
			if (!instanceId) return;
			for (let i = 0; i < 60; i++) {
				await new Promise((resolve) => setTimeout(resolve, 4000));
				try {
					const data = await apiClient.get<{ instance: { status: string } }>(
						`/vps/${instanceId}`,
					);
					if (data.instance?.status === targetStatus) return;
				} catch {
					// continue polling
				}
			}
			throw new Error("Timed out waiting for VPS status change");
		},
		[instanceId],
	);

	const pollDiskStatus = useCallback(
		async (diskId: number, targetStatus: string): Promise<void> => {
			if (!instanceId) return;
			for (let i = 0; i < 90; i++) {
				await new Promise((resolve) => setTimeout(resolve, 3000));
				try {
					const data = await apiClient.get<{ disk: { status: string } }>(
						`/vps/${instanceId}/disks/${diskId}`,
					);
					if (data.disk?.status === targetStatus) return;
				} catch {
					// continue polling
				}
			}
			throw new Error("Timed out waiting for disk resize to complete");
		},
		[instanceId],
	);

	const handleDelete = async (diskId: number, diskLabel: string) => {
		if (!instanceId) return;
		setDeleteConfirm({ open: false, diskId: 0, diskLabel: "" });
		setActionLoading(diskId);
		try {
			await apiClient.delete(`/vps/${instanceId}/disks/${diskId}`);
			toast.success(`Disk "${diskLabel}" deleted`);
			await loadDisks();
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Failed to delete disk");
		} finally {
			setActionLoading(null);
		}
	};

	const handlePasswordReset = async (diskId: number, diskLabel: string) => {
		if (!instanceId) return;
		const password = prompt(`Enter new root password for disk "${diskLabel}":`);
		if (!password) return;
		if (password.length < 8) {
			toast.error("Password must be at least 8 characters");
			return;
		}

		setActionLoading(diskId);
		try {
			await apiClient.post(`/vps/${instanceId}/disks/${diskId}/password`, {
				password,
			});
			toast.success(`Password reset for disk "${diskLabel}"`);
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to reset password",
			);
		} finally {
			setActionLoading(null);
		}
	};

	const handleSetOsDisk = async (diskId: number) => {
		if (!instanceId) return;
		setOsDiskSaving(true);
		try {
			await apiClient.put(`/vps/${instanceId}/os-disk`, { diskId });
			setLocalBootDiskId(diskId);
			setConfirmOsDiskId(null);
			toast.success("OS drive updated");
		} catch (err) {
			toast.error(
				err instanceof Error ? err.message : "Failed to set OS drive",
			);
		} finally {
			setOsDiskSaving(false);
		}
	};

	// --- Resize orchestration ---

	const openResizeDialog = (
		diskId: number,
		currentSize: number,
		diskLabel: string,
	) => {
		setResizeDialog({ open: true, diskId, diskLabel, currentSize });
		setResizeSize(String(currentSize));
		setResizePhase("idle");
	};

	const closeResizeDialog = () => {
		if (isOrchestrating) return;
		setResizeDialog({
			open: false,
			diskId: null,
			diskLabel: "",
			currentSize: 0,
		});
		setResizeSize("");
		setResizePhase("idle");
	};

	const getLiveStatus = useCallback(async (): Promise<string | null> => {
		if (!instanceId) return null;
		try {
			const data = await apiClient.get<{ instance: { status: string } }>(
				`/vps/${instanceId}`,
			);
			return data.instance?.status ?? null;
		} catch {
			return null;
		}
	}, [instanceId]);

	const executeResize = async () => {
		if (!instanceId || !resizeDialog.diskId) return;
		const newSize = parseInt(resizeSize, 10);
		if (isNaN(newSize) || newSize < 1) {
			toast.error("Size must be a positive number");
			return;
		}
		const maxSize = totalDiskAllocation
			? resizeDialog.currentSize + unallocatedSpace
			: undefined;
		if (maxSize && newSize > maxSize) {
			toast.error(`Size cannot exceed ${maxSize} MB (current + unallocated)`);
			return;
		}

		const liveStatus = await getLiveStatus();
		const wasRunning = liveStatus === "running";

		try {
			// Phase 1: Shutdown if running
			if (wasRunning) {
				setResizePhase("shutting-down");
				await apiClient.post(`/vps/${instanceId}/shutdown`);
				await pollInstanceStatus("stopped");
			}

			// Phase 2: Resize
			setResizePhase("resizing");
			await apiClient.post(
				`/vps/${instanceId}/disks/${resizeDialog.diskId}/resize`,
				{
					size: newSize,
				},
			);

			// Wait for the disk to finish resizing (status returns to "ready")
			await pollDiskStatus(resizeDialog.diskId!, "ready");

			// Phase 3: Boot the VPS back up
			setResizePhase("booting");
			await apiClient.post(`/vps/${instanceId}/boot`);

			toast.success(
				`Disk "${resizeDialog.diskLabel}" resized to ${(newSize / 1024).toFixed(1)} GB`,
			);
			setResizeDialog({
				open: false,
				diskId: null,
				diskLabel: "",
				currentSize: 0,
			});
			setResizeSize("");
			setResizePhase("idle");
			await loadDisks();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Operation failed";
			toast.error(message);

			// Try to boot the VPS back up after a failure
			if (resizePhase !== "idle") {
				try {
					await apiClient.post(`/vps/${instanceId}/boot`);
					toast.info("VPS has been booted back up");
				} catch {
					toast.error("Failed to boot VPS back up — please boot manually");
				}
			}
			setResizePhase("idle");
			setResizeDialog({
				open: false,
				diskId: null,
				diskLabel: "",
				currentSize: 0,
			});
		}
	};

	// --- Create disk orchestration ---

	const openCreateDialog = () => {
		setCreateDialog({ open: true, label: "", filesystem: "ext4", size: "" });
		setCreatePhase("idle");
	};

	const closeCreateDialog = () => {
		if (isOrchestrating) return;
		setCreateDialog({ open: false, label: "", filesystem: "ext4", size: "" });
		setCreatePhase("idle");
	};

	const executeCreateDisk = async () => {
		if (!instanceId) return;
		const size = parseInt(createDialog.size, 10);
		if (isNaN(size) || size < 1) {
			toast.error("Size must be a positive number");
			return;
		}
		if (!createDialog.label.trim()) {
			toast.error("Label is required");
			return;
		}
		if (totalDiskAllocation && size > unallocatedSpace) {
			toast.error(`Only ${unallocatedSpace} MB available`);
			return;
		}

		const liveStatus = await getLiveStatus();
		const wasRunning = liveStatus === "running";

		try {
			if (wasRunning) {
				setCreatePhase("shutting-down");
				await apiClient.post(`/vps/${instanceId}/shutdown`);
				await pollInstanceStatus("stopped");
			}

			setCreatePhase("creating");
			await apiClient.post(`/vps/${instanceId}/disks`, {
				label: createDialog.label.trim(),
				filesystem: createDialog.filesystem,
				size,
			});

			if (wasRunning) {
				setCreatePhase("booting");
				await apiClient.post(`/vps/${instanceId}/boot`);
			}

			toast.success(`Disk "${createDialog.label}" created`);
			setCreateDialog({ open: false, label: "", filesystem: "ext4", size: "" });
			setCreatePhase("idle");
			await loadDisks();
		} catch (err) {
			const message = err instanceof Error ? err.message : "Operation failed";
			toast.error(message);

			if (wasRunning && createPhase !== "idle") {
				try {
					await apiClient.post(`/vps/${instanceId}/boot`);
					toast.info("VPS has been booted back up");
				} catch {
					toast.error("Failed to boot VPS back up — please boot manually");
				}
			}
			setCreatePhase("idle");
			setCreateDialog({ open: false, label: "", filesystem: "ext4", size: "" });
		}
	};

	// --- Phase label helper ---
	const phaseLabel = (phase: OrchestrationPhase) => {
		switch (phase) {
			case "shutting-down":
				return "Shutting down VPS...";
			case "resizing":
				return "Resizing disk...";
			case "creating":
				return "Creating disk...";
			case "booting":
				return "Booting VPS...";
			default:
				return "";
		}
	};

	if (loading && disks.length === 0) {
		return (
			<section className="rounded-2xl cyber-card cyber-card--hover">
				<div className="flex items-center justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					<span className="ml-2 text-sm text-muted-foreground">
						Loading disks...
					</span>
				</div>
			</section>
		);
	}

	if (error) {
		return (
			<section className="rounded-2xl cyber-card cyber-card--hover">
				<div className="px-6 py-8 text-center">
					<AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
					<p className="text-sm text-muted-foreground mb-3">{error}</p>
					<Button variant="outline" size="sm" onClick={loadDisks}>
						<RefreshCw className="h-3 w-3 mr-1.5" />
						Retry
					</Button>
				</div>
			</section>
		);
	}

	return (
		<section className="rounded-2xl cyber-card cyber-card--hover">
			<div className="border-b border-border px-6 sm:px-8 py-4 sm:py-6">
				<div className="flex items-center justify-between">
					<div>
						<h2 className="flex items-center gap-2 text-base sm:text-lg font-semibold text-foreground">
							<HardDrive className="h-5 w-5 text-primary" />
							<span>Disks</span>
						</h2>
						<p className="text-xs sm:text-sm text-muted-foreground mt-1">
							Manage storage disks for {instanceLabel ?? "this instance"}.
						</p>
					</div>
					<div className="flex gap-2">
						{totalDiskAllocation ? (
							<Button
								variant="outline"
								size="sm"
								onClick={openCreateDialog}
								disabled={isOrchestrating || unallocatedSpace <= 0}
								title={
									unallocatedSpace <= 0
										? "No unallocated space available"
										: "Create a new disk"
								}
							>
								<Plus className="h-3 w-3 mr-1.5" />
								Create Disk
							</Button>
						) : null}
						<Button
							variant="outline"
							size="sm"
							onClick={loadDisks}
							disabled={loading}
						>
							<RefreshCw
								className={`h-3 w-3 mr-1.5 ${loading ? "animate-spin" : ""}`}
							/>
							Refresh
						</Button>
					</div>
				</div>
				{totalDiskAllocation ? (
					<div className="mt-3 text-xs text-muted-foreground">
						Total: {(totalDiskAllocation / 1024).toFixed(1)} GB — Used:{" "}
						{(usedSpace / 1024).toFixed(1)} GB — Unallocated:{" "}
						{(unallocatedSpace / 1024).toFixed(1)} GB
					</div>
				) : null}
			</div>

			<div className="px-6 sm:px-8 py-5">
				{disks.length === 0 ? (
					<div className="text-center py-8">
						<HardDrive className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
						<p className="text-sm text-muted-foreground">No disks found.</p>
					</div>
				) : (
					<div className="space-y-3">
						{disks.map((disk) => {
							const isSwap = disk.filesystem === "swap";
							const isOsDisk = effectiveBootDiskId === disk.id;
							const showConfirm = confirmOsDiskId === disk.id;

							return (
								<div
									key={disk.id}
									className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border p-4"
								>
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2">
											<HardDrive className="h-4 w-4 text-muted-foreground flex-shrink-0" />
											<span className="font-medium text-sm text-foreground truncate">
												{disk.label}
											</span>
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
													disk.status === "ready"
														? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
														: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
												}`}
											>
												{disk.status}
											</span>
											{isOsDisk && !isSwap && (
												<span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
													<Monitor className="h-3 w-3 mr-1" />
													OS
												</span>
											)}
										</div>
										<div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
											<span>{(disk.size / 1024).toFixed(1)} GB</span>
											<span>{disk.filesystem || "raw"}</span>
											<span>ID: {disk.id}</span>
										</div>
									</div>

									<div className="flex flex-wrap gap-2">
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												openResizeDialog(disk.id, disk.size, disk.label)
											}
											disabled={actionLoading === disk.id || isOrchestrating}
											title="Resize disk"
										>
											<Edit2 className="h-3 w-3" />
											<span className="ml-1">Resize</span>
										</Button>
										{!isSwap && isOsDisk && (
											<Button
												variant="outline"
												size="sm"
												onClick={() => handlePasswordReset(disk.id, disk.label)}
												disabled={actionLoading === disk.id || isOrchestrating}
												title="Reset root password"
											>
												<Key className="h-3 w-3" />
												<span className="ml-1">Password</span>
											</Button>
										)}
										{!isSwap && !isOsDisk && (
											<>
												{!showConfirm ? (
													<Button
														variant="outline"
														size="sm"
														onClick={() => setConfirmOsDiskId(disk.id)}
														disabled={isOrchestrating || osDiskSaving}
														title="Set this disk as the OS drive to enable password reset"
														className="text-primary hover:text-primary"
													>
														<Monitor className="h-3 w-3" />
														<span className="ml-1">Set as OS drive</span>
													</Button>
												) : (
													<div className="flex items-center gap-1.5">
														<span className="text-xs text-muted-foreground">
															Confirm?
														</span>
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleSetOsDisk(disk.id)}
															disabled={osDiskSaving}
															className="h-8 px-2"
														>
															{osDiskSaving ? (
																<Loader2 className="h-3 w-3 animate-spin" />
															) : (
																<CheckCircle2 className="h-3 w-3" />
															)}
															<span className="ml-1">Yes</span>
														</Button>
														<Button
															variant="outline"
															size="sm"
															onClick={() => setConfirmOsDiskId(null)}
															disabled={osDiskSaving}
															className="h-8 px-2"
														>
															<X className="h-3 w-3" />
															<span className="ml-1">No</span>
														</Button>
													</div>
												)}
											</>
										)}
										<Button
											variant="outline"
											size="sm"
											onClick={() =>
												setDeleteConfirm({
													open: true,
													diskId: disk.id,
													diskLabel: disk.label,
												})
											}
											disabled={actionLoading === disk.id || isOrchestrating}
											className="text-destructive hover:text-destructive"
											title="Delete disk"
										>
											<Trash2 className="h-3 w-3" />
											<span className="ml-1">Delete</span>
										</Button>
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Resize Disk Dialog */}
			<Dialog
				open={resizeDialog.open}
				onOpenChange={(open) => !open && closeResizeDialog()}
			>
				<DialogContent className="font-mono">
					<DialogHeader>
						<DialogTitle>Resize Disk — {resizeDialog.diskLabel}</DialogTitle>
						<DialogDescription>
							Current size: {resizeDialog.currentSize} MB (
							{(resizeDialog.currentSize / 1024).toFixed(1)} GB)
						</DialogDescription>
					</DialogHeader>

					{resizePhase !== "idle" ? (
						<div className="flex items-center gap-3 py-4">
							<Loader2 className="h-5 w-5 animate-spin text-primary" />
							<span className="text-sm">{phaseLabel(resizePhase)}</span>
						</div>
					) : (
						<>
							{isRunning && (
								<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
									<AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
									<div className="text-sm text-amber-200">
										This VPS is currently running. It will be automatically shut
										down, resized, and booted back up.
									</div>
								</div>
							)}

							<div className="space-y-2">
								<label className="text-sm font-medium text-foreground">
									New size (MB)
								</label>
								<input
									type="number"
									value={resizeSize}
									onChange={(e) => setResizeSize(e.target.value)}
									className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
									min={1}
								/>
								{resizeSize && !isNaN(Number(resizeSize)) && (
									<p className="text-xs text-muted-foreground">
										{(Number(resizeSize) / 1024).toFixed(1)} GB
										{Number(resizeSize) < resizeDialog.currentSize
											? " (shrinking)"
											: Number(resizeSize) > resizeDialog.currentSize
												? " (growing)"
												: " (no change)"}
									</p>
								)}
								{totalDiskAllocation ? (
									<p className="text-xs text-muted-foreground">
										Max: {resizeDialog.currentSize + unallocatedSpace} MB
										(current + {unallocatedSpace} MB unallocated)
									</p>
								) : null}
							</div>
						</>
					)}

					<DialogFooter>
						{resizePhase === "idle" ? (
							<>
								<Button variant="outline" onClick={closeResizeDialog}>
									Cancel
								</Button>
								<Button
									onClick={executeResize}
									disabled={
										!resizeSize ||
										isNaN(Number(resizeSize)) ||
										Number(resizeSize) < 1 ||
										Number(resizeSize) === resizeDialog.currentSize
									}
								>
									{isRunning ? "Shutdown & Resize & Boot" : "Resize Disk"}
								</Button>
							</>
						) : (
							<p className="text-xs text-muted-foreground">
								Please wait, this may take a minute...
							</p>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Create Disk Dialog */}
			<Dialog
				open={createDialog.open}
				onOpenChange={(open) => !open && closeCreateDialog()}
			>
				<DialogContent className="font-mono">
					<DialogHeader>
						<DialogTitle>Create Disk</DialogTitle>
						<DialogDescription>
							{totalDiskAllocation
								? `Available space: ${unallocatedSpace} MB (${(unallocatedSpace / 1024).toFixed(1)} GB)`
								: "Create a new disk on this VPS"}
						</DialogDescription>
					</DialogHeader>

					{createPhase !== "idle" ? (
						<div className="flex items-center gap-3 py-4">
							<Loader2 className="h-5 w-5 animate-spin text-primary" />
							<span className="text-sm">{phaseLabel(createPhase)}</span>
						</div>
					) : (
						<>
							{isRunning && (
								<div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
									<AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
									<div className="text-sm text-amber-200">
										This VPS is currently running. It will be automatically shut
										down, the disk created, and then booted back up.
									</div>
								</div>
							)}

							<div className="space-y-3">
								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground">
										Label
									</label>
									<input
										type="text"
										value={createDialog.label}
										onChange={(e) =>
											setCreateDialog((prev) => ({
												...prev,
												label: e.target.value,
											}))
										}
										className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
										placeholder="e.g. Data Disk"
										maxLength={48}
									/>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground">
										Filesystem
									</label>
									<Select
										value={createDialog.filesystem}
										onValueChange={(value) =>
											setCreateDialog((prev) => ({
												...prev,
												filesystem: value,
											}))
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="ext4">ext4</SelectItem>
											<SelectItem value="ext3">ext3</SelectItem>
											<SelectItem value="swap">swap</SelectItem>
											<SelectItem value="raw">raw</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-2">
									<label className="text-sm font-medium text-foreground">
										Size (MB)
									</label>
									<input
										type="number"
										value={createDialog.size}
										onChange={(e) =>
											setCreateDialog((prev) => ({
												...prev,
												size: e.target.value,
											}))
										}
										className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
										min={1}
										max={unallocatedSpace || undefined}
									/>
									{createDialog.size && !isNaN(Number(createDialog.size)) && (
										<p className="text-xs text-muted-foreground">
											{(Number(createDialog.size) / 1024).toFixed(1)} GB
										</p>
									)}
								</div>
							</div>
						</>
					)}

					<DialogFooter>
						{createPhase === "idle" ? (
							<>
								<Button variant="outline" onClick={closeCreateDialog}>
									Cancel
								</Button>
								<Button
									onClick={executeCreateDisk}
									disabled={
										!createDialog.label.trim() ||
										!createDialog.size ||
										isNaN(Number(createDialog.size)) ||
										Number(createDialog.size) < 1
									}
								>
									{isRunning ? "Shutdown & Create & Boot" : "Create Disk"}
								</Button>
							</>
						) : (
							<p className="text-xs text-muted-foreground">
								Please wait, this may take a minute...
							</p>
						)}
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Confirmation Dialog */}
			<ConfirmationDialog
				isOpen={deleteConfirm.open}
				onClose={() =>
					setDeleteConfirm({ open: false, diskId: 0, diskLabel: "" })
				}
				onConfirm={() =>
					handleDelete(deleteConfirm.diskId, deleteConfirm.diskLabel)
				}
				title={`Delete Disk "${deleteConfirm.diskLabel}"?`}
				description="This action cannot be undone. All data on this disk will be permanently deleted."
				confirmText="Delete"
				variant="destructive"
				isLoading={actionLoading === deleteConfirm.diskId}
			/>
		</section>
	);
}
