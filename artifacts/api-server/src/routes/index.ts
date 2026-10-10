import { Router, type IRouter } from "express";
import healthRouter from "./health";
import studycircleRouter from "./studycircle";
import leaderboardRouter from "./leaderboard";
import { scheduleRouter } from "./schedule";
import { subjectsRouter } from "./subjects";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/admin", adminRouter);
router.use(studycircleRouter);
router.use(leaderboardRouter);
router.use("/schedule", scheduleRouter);
router.use("/subjects", subjectsRouter);

export default router;
