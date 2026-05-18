import express, { type Request, type Response } from "express";
import { query } from "../../lib/database.js";
import { handleProviderError } from "../../lib/errorHandling.js";
import {
	authenticateToken,
	requireOrganization,
} from "../../middleware/auth.js";
import { logActivity } from "../../services/activityLogger.js";
import { linodeService } from "../../services/linodeService.js";
import { RoleService } from "../../services/roles.js";
import {
	mapConfigProfile,
	normalizeProviderStatus,
	resolveBootDiskId,
} from "./shared/types.js";
import {
	BRANDED_TEMPLATE_PREFIX,
	DEFAULT_RDNS_BASE_DOMAIN,
	isBrandedTemplateId,
	LEGACY_TEMPLATE_PREFIX,
	loadProviderTokenById,
	normalizeImageTemplate,
	resolveImageForProvider,
	toBrandedTemplateId,
} from "./shared/utils.js";

const router = express.Router();

async function resolveVpsInstance(
	req: Request,
	res: Response,
	permission: "vps_manage" | "vps_view" = "vps_manage",
) {
	const { id } = req.params;
	const user = (req as any).user;
	const userId = user.id;
	const userRole = user.role;
	const organizationId = user.organizationId;

	if (userRole !== "admin") {
		const hasPermission = await RoleService.checkPermission(
			userId,
			organizationId,
			permission,
		);
		if (!hasPermission) {
			res
				.status(403)
				.json({ error: "Insufficient permissions", required: permission });
			return null;
		}
	}

	let rowRes;
	if (userRole === "admin") {
		rowRes = await query("SELECT * FROM vps_instances WHERE id = $1", [id]);
	} else {
		rowRes = await query(
			"SELECT * FROM vps_instances WHERE id = $1 AND organization_id = $2",
			[id, organizationId],
		);
	}

	if (rowRes.rows.length === 0) {
		res.status(404).json({ error: "Instance not found" });
		return null;
	}

	const row = rowRes.rows[0];
	const providerInstanceId = Number(row.provider_instance_id);
	if (!Number.isFinite(providerInstanceId)) {
		res.status(400).json({ error: "Instance is missing provider reference" });
		return null;
	}

	return { row, providerInstanceId, user };
}

router.get("/:id/disks", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res, "vps_view");
		if (!ctx) return;

		const disks = await linodeService.listDisks(ctx.providerInstanceId);

		let configBootDiskId: number | null = null;
		try {
			const configData = await linodeService.getLinodeInstanceConfigs(
				ctx.providerInstanceId,
			);
			const configs = Array.isArray((configData as any)?.data)
				? (configData as any).data.map(mapConfigProfile).filter(Boolean)
				: [];
			configBootDiskId = resolveBootDiskId(configs);
		} catch {
			// Config profiles may not be available; fall through
		}

		const osDiskId: number | null = ctx.row.os_disk_id
			? Number(ctx.row.os_disk_id)
			: null;
		const bootDiskId = osDiskId ?? configBootDiskId;

		res.json({ disks, bootDiskId });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "list disks");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.get("/:id/disks/:diskId", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res, "vps_view");
		if (!ctx) return;

		const diskId = Number(req.params.diskId);
		if (!Number.isFinite(diskId)) {
			return res.status(400).json({ error: "Invalid disk ID" });
		}

		const disk = await linodeService.getDisk(ctx.providerInstanceId, diskId);
		res.json({ disk });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "get disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.post("/:id/disks", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res);
		if (!ctx) return;

		const {
			label,
			size,
			filesystem,
			image,
			root_pass,
			authorized_keys,
			stackscript_id,
			stackscript_data,
		} = req.body;
		if (!label || !size) {
			return res.status(400).json({ error: "label and size are required" });
		}
		if (typeof size !== "number" || size < 1) {
			return res
				.status(400)
				.json({ error: "size must be a positive number (MB)" });
		}

		const disk = await linodeService.createDisk(ctx.providerInstanceId, {
			label,
			size,
			filesystem,
			image,
			root_pass,
			authorized_keys,
			stackscript_id,
			stackscript_data,
		});

		await logActivity(
			{
				userId: ctx.user.id,
				organizationId: ctx.user.organizationId,
				eventType: "vps.disk.create",
				entityType: "disk",
				entityId: String(disk.id),
				message: `Created disk '${label}' on VPS '${ctx.row.label}'`,
				status: "success",
				metadata: { instanceId: ctx.row.id, diskId: disk.id, size },
			},
			req as any,
		);

		res.status(201).json({ disk });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "create disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.put("/:id/disks/:diskId", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res);
		if (!ctx) return;

		const diskId = Number(req.params.diskId);
		if (!Number.isFinite(diskId)) {
			return res.status(400).json({ error: "Invalid disk ID" });
		}

		const { label, filesystem } = req.body;
		const params: { label?: string; filesystem?: string } = {};
		if (label) params.label = label;
		if (filesystem) params.filesystem = filesystem;

		const disk = await linodeService.updateDisk(
			ctx.providerInstanceId,
			diskId,
			params,
		);

		await logActivity(
			{
				userId: ctx.user.id,
				organizationId: ctx.user.organizationId,
				eventType: "vps.disk.update",
				entityType: "disk",
				entityId: String(diskId),
				message: `Updated disk ${diskId} on VPS '${ctx.row.label}'`,
				status: "success",
				metadata: { instanceId: ctx.row.id, diskId, updates: params },
			},
			req as any,
		);

		res.json({ disk });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "update disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.post(
	"/:id/disks/:diskId/resize",
	async (req: Request, res: Response) => {
		try {
			const ctx = await resolveVpsInstance(req, res);
			if (!ctx) return;

			const diskId = Number(req.params.diskId);
			if (!Number.isFinite(diskId)) {
				return res.status(400).json({ error: "Invalid disk ID" });
			}

			const { size } = req.body;
			if (!size || typeof size !== "number" || size < 1) {
				return res
					.status(400)
					.json({ error: "size must be a positive number (MB)" });
			}

			await linodeService.resizeDisk(ctx.providerInstanceId, diskId, size);

			await logActivity(
				{
					userId: ctx.user.id,
					organizationId: ctx.user.organizationId,
					eventType: "vps.disk.resize",
					entityType: "disk",
					entityId: String(diskId),
					message: `Resized disk ${diskId} to ${size}MB on VPS '${ctx.row.label}'`,
					status: "success",
					metadata: { instanceId: ctx.row.id, diskId, newSize: size },
				},
				req as any,
			);

			res.json({ success: true });
		} catch (err: any) {
			const structuredError = handleProviderError(err, "linode", "resize disk");
			res
				.status(structuredError.statusCode)
				.json({ error: structuredError.message });
		}
	},
);

router.post("/:id/disks/:diskId/clone", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res);
		if (!ctx) return;

		const diskId = Number(req.params.diskId);
		if (!Number.isFinite(diskId)) {
			return res.status(400).json({ error: "Invalid disk ID" });
		}

		const disk = await linodeService.cloneDisk(ctx.providerInstanceId, diskId);

		await logActivity(
			{
				userId: ctx.user.id,
				organizationId: ctx.user.organizationId,
				eventType: "vps.disk.clone",
				entityType: "disk",
				entityId: String(disk.id),
				message: `Cloned disk ${diskId} on VPS '${ctx.row.label}'`,
				status: "success",
				metadata: {
					instanceId: ctx.row.id,
					sourceDiskId: diskId,
					newDiskId: disk.id,
				},
			},
			req as any,
		);

		res.status(201).json({ disk });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "clone disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.post(
	"/:id/disks/:diskId/password",
	async (req: Request, res: Response) => {
		try {
			const ctx = await resolveVpsInstance(req, res);
			if (!ctx) return;

			const diskId = Number(req.params.diskId);
			if (!Number.isFinite(diskId)) {
				return res.status(400).json({ error: "Invalid disk ID" });
			}

			const { password } = req.body;
			if (!password || typeof password !== "string" || password.length < 8) {
				return res.status(400).json({
					error: "password is required and must be at least 8 characters",
				});
			}

			await linodeService.resetDiskPassword(
				ctx.providerInstanceId,
				diskId,
				password,
			);

			await logActivity(
				{
					userId: ctx.user.id,
					organizationId: ctx.user.organizationId,
					eventType: "vps.disk.password_reset",
					entityType: "disk",
					entityId: String(diskId),
					message: `Reset password for disk ${diskId} on VPS '${ctx.row.label}'`,
					status: "success",
					metadata: { instanceId: ctx.row.id, diskId },
					suppressNotification: true,
				},
				req as any,
			);

			res.json({ success: true });
		} catch (err: any) {
			const structuredError = handleProviderError(
				err,
				"linode",
				"reset disk password",
			);
			res
				.status(structuredError.statusCode)
				.json({ error: structuredError.message });
		}
	},
);

router.delete("/:id/disks/:diskId", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res);
		if (!ctx) return;

		const diskId = Number(req.params.diskId);
		if (!Number.isFinite(diskId)) {
			return res.status(400).json({ error: "Invalid disk ID" });
		}

		await linodeService.deleteDisk(ctx.providerInstanceId, diskId);

		await logActivity(
			{
				userId: ctx.user.id,
				organizationId: ctx.user.organizationId,
				eventType: "vps.disk.delete",
				entityType: "disk",
				entityId: String(diskId),
				message: `Deleted disk ${diskId} from VPS '${ctx.row.label}'`,
				status: "success",
				metadata: { instanceId: ctx.row.id, diskId },
			},
			req as any,
		);

		res.json({ success: true });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "delete disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

router.put("/:id/os-disk", async (req: Request, res: Response) => {
	try {
		const ctx = await resolveVpsInstance(req, res);
		if (!ctx) return;

		const { diskId } = req.body;
		if (typeof diskId !== "number" || !Number.isFinite(diskId)) {
			return res.status(400).json({ error: "diskId must be a number" });
		}

		const disks = await linodeService.listDisks(ctx.providerInstanceId);
		const targetDisk = disks.find((d: any) => d.id === diskId);
		if (!targetDisk) {
			return res.status(404).json({ error: "Disk not found on this instance" });
		}
		if (targetDisk.filesystem === "swap") {
			return res
				.status(400)
				.json({ error: "Cannot set a swap disk as the OS disk" });
		}

		await query(
			"UPDATE vps_instances SET os_disk_id = $1, updated_at = NOW() WHERE id = $2",
			[diskId, ctx.row.id],
		);

		await logActivity(
			{
				userId: ctx.user.id,
				organizationId: ctx.user.organizationId,
				eventType: "vps.os_disk_set",
				entityType: "disk",
				entityId: String(diskId),
				message: `Set OS disk to ${diskId} (${targetDisk.label}) on VPS '${ctx.row.label}'`,
				status: "success",
				metadata: { instanceId: ctx.row.id, diskId },
			},
			req as any,
		);

		res.json({ success: true, osDiskId: diskId });
	} catch (err: any) {
		const structuredError = handleProviderError(err, "linode", "set OS disk");
		res
			.status(structuredError.statusCode)
			.json({ error: structuredError.message });
	}
});

export default router;
