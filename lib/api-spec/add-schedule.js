import fs from "fs";
import yaml from "yaml";

const file = fs.readFileSync("openapi.yaml", "utf8");
const doc = yaml.parse(file);

// Add schedule endpoints
doc.paths["/api/schedule"] = {
  get: {
    summary: "Get schedule slots",
    operationId: "listSchedule",
    tags: ["Schedule"],
    parameters: [
      {
        name: "startDate",
        in: "query",
        schema: { type: "string" },
        required: false
      },
      {
        name: "endDate",
        in: "query",
        schema: { type: "string" },
        required: false
      }
    ],
    responses: {
      "200": {
        description: "List of schedule slots",
        content: {
          "application/json": {
            schema: {
              type: "array",
              items: {
                $ref: "#/components/schemas/ScheduleSlot"
              }
            }
          }
        }
      }
    }
  },
  post: {
    summary: "Create schedule slot",
    operationId: "createSchedule",
    tags: ["Schedule"],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/InsertScheduleSlot"
          }
        }
      }
    },
    responses: {
      "201": {
        description: "Created",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ScheduleSlot"
            }
          }
        }
      }
    }
  }
};

doc.paths["/api/schedule/{id}"] = {
  put: {
    summary: "Update schedule slot",
    operationId: "updateSchedule",
    tags: ["Schedule"],
    parameters: [
      {
        name: "id",
        in: "path",
        schema: { type: "string" },
        required: true
      }
    ],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            $ref: "#/components/schemas/UpdateScheduleSlot"
          }
        }
      }
    },
    responses: {
      "200": {
        description: "Updated",
        content: {
          "application/json": {
            schema: {
              $ref: "#/components/schemas/ScheduleSlot"
            }
          }
        }
      }
    }
  },
  delete: {
    summary: "Delete schedule slot",
    operationId: "deleteSchedule",
    tags: ["Schedule"],
    parameters: [
      {
        name: "id",
        in: "path",
        schema: { type: "string" },
        required: true
      }
    ],
    responses: {
      "200": {
        description: "Deleted",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                success: { type: "boolean" }
              }
            }
          }
        }
      }
    }
  }
};

doc.components.schemas["ScheduleSlot"] = {
  type: "object",
  required: ["id", "userId", "subjectId", "title", "startTime", "endTime", "isRecurring", "isCompleted", "createdAt", "updatedAt"],
  properties: {
    id: { type: "string" },
    userId: { type: "string" },
    subjectId: { type: "string" },
    title: { type: "string" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    date: { type: "string", nullable: true },
    isRecurring: { type: "boolean" },
    daysOfWeek: { type: "string", nullable: true },
    isCompleted: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  }
};

doc.components.schemas["InsertScheduleSlot"] = {
  type: "object",
  required: ["subjectId", "title", "startTime", "endTime"],
  properties: {
    subjectId: { type: "string" },
    title: { type: "string" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    date: { type: "string" },
    isRecurring: { type: "boolean" },
    daysOfWeek: { type: "string" },
    isCompleted: { type: "boolean" }
  }
};

doc.components.schemas["UpdateScheduleSlot"] = {
  type: "object",
  properties: {
    subjectId: { type: "string" },
    title: { type: "string" },
    startTime: { type: "string" },
    endTime: { type: "string" },
    date: { type: "string" },
    isRecurring: { type: "boolean" },
    daysOfWeek: { type: "string" },
    isCompleted: { type: "boolean" }
  }
};

fs.writeFileSync("openapi.yaml", yaml.stringify(doc), "utf8");
console.log("done");
