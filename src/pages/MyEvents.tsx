import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Search,
  Users,
  Eye,
  CheckCircle,
  XCircle,
  Loader2,
  User,
  Plus,
  CreditCard,
  Star,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Event {
  id: string;
  title: string;
  description: string;
  event_type: string;
  format: string;
  location?: string;
  date_time: string;
  duration_hours: number;
  budget_min?: number;
  budget_max?: number;
  required_topics: string[];
  status: string;
  created_at: string;
}

interface Booking {
  id: string;
  status: string;
  agreed_rate?: number;
  message?: string;
  created_at: string;
  organizer_rating?: number;
  organizer_feedback?: string;
  speaker: {
    id: string;
    hourly_rate?: number;
    experience_level: string;
    average_rating: number;
    total_talks: number;
    profile: {
      full_name: string;
      avatar_url?: string;
      bio?: string;
      location?: string;
    };
  };
  event: {
    id: string;
    title: string;
    date_time?: string;
    location?: string;
    format?: string;
    duration_hours: number;
  };
}

const MyEvents = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [confirmedSpeakers, setConfirmedSpeakers] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ user_type: string } | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [eventBookings, setEventBookings] = useState<Booking[]>([]);
  const [eventConfirmedSpeakers, setEventConfirmedSpeakers] = useState<
    Booking[]
  >([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Review state
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [selectedSpeaker, setSelectedSpeaker] = useState<{
    speakerId: string;
    speakerName: string;
    eventTitle: string;
    bookingId: string;
  } | null>(null);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    feedback: "",
  });
  const [reviewLoading, setReviewLoading] = useState(false);

  // Event creation dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [topics, setTopics] = useState<Array<{ id: string; name: string }>>([]);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    event_type: "lecture" as
      | "lecture"
      | "seminar"
      | "workshop"
      | "webinar"
      | "conference"
      | "other",
    format: "in-person" as "in-person" | "virtual" | "hybrid",
    location: "",
    date_time: "",
    duration_hours: "",
    budget_min: "",
    budget_max: "",
    required_topics: [] as string[],
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchMyEvents();
      fetchMyBookings();
      fetchConfirmedSpeakers();
      loadTopics();
    }
  }, [user]);

  // Add focus event listener to refresh data when user returns to page
  useEffect(() => {
    const handleFocus = () => {
      if (user) {
        fetchMyBookings();
        fetchConfirmedSpeakers();
      }
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_type")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
    }
  };

  const fetchMyEvents = async () => {
    if (!user) return;

    try {
      // Get user's profile ID first
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch events created by this user
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("organizer_id", profile.id)
        .order("date_time", { ascending: true });

      if (error) throw error;

      // Auto-update event statuses based on current date
      const now = new Date();
      const eventsToUpdate = [];
      
      for (const event of data || []) {
        const eventDate = new Date(event.date_time);
        const eventEndTime = new Date(eventDate.getTime() + (event.duration_hours * 60 * 60 * 1000));
        
        // If event has ended and status is still "open" or "in_progress", mark as "finished"
        if (eventEndTime < now && (event.status === "open" || event.status === "in_progress")) {
          eventsToUpdate.push({
            id: event.id,
            status: "finished"
          });
        }
      }

      // Update event statuses if needed
      if (eventsToUpdate.length > 0) {
        for (const update of eventsToUpdate) {
          await supabase
            .from("events")
            .update({ status: update.status })
            .eq("id", update.id);
        }

        // Fetch updated events
        const { data: updatedData, error: updateError } = await supabase
          .from("events")
          .select("*")
          .eq("organizer_id", profile.id)
          .order("date_time", { ascending: true });

        if (updateError) throw updateError;
        setEvents(updatedData || []);
      } else {
        setEvents(data || []);
      }
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({
        title: "Error loading events",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchMyBookings = async () => {
    if (!user) return;

    try {
      // Get user's profile ID first
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch bookings for events organized by this user (exclude paid ones for applications view)
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          speaker:speakers!speaker_id(
            id,
            hourly_rate,
            experience_level,
            average_rating,
            total_talks,
            profile:profiles!profile_id(full_name, avatar_url, bio, location)
          ),
          event:events!event_id(id, title, duration_hours)
        `
        )
        .eq("organizer_id", profile.id)
        .neq("status", "paid")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error) {
      console.error("Error fetching bookings:", error);
    }
  };

  const fetchConfirmedSpeakers = async () => {
    if (!user) return;

    try {
      // Get user's profile ID first
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Fetch confirmed speakers (accepted and paid bookings) for events organized by this user
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          speaker:speakers!speaker_id(
            id,
            hourly_rate,
            experience_level,
            average_rating,
            total_talks,
            profile:profiles!profile_id(full_name, avatar_url, bio, location)
          ),
          event:events!event_id(id, title, date_time, location, format, duration_hours)
        `
        )
        .eq("organizer_id", profile.id)
        .in("status", ["accepted", "paid"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConfirmedSpeakers(data || []);
    } catch (error) {
      console.error("Error fetching confirmed speakers:", error);
    }
  };

  const fetchEventBookings = async (eventId: string) => {
    setBookingLoading(true);
    try {
      // Fetch all bookings for this event
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          speaker:speakers!speaker_id(
            id,
            hourly_rate,
            experience_level,
            average_rating,
            total_talks,
            profile:profiles!profile_id(full_name, avatar_url, bio, location)
          ),
          event:events!event_id(id, title, duration_hours)
        `
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const allBookings = data || [];

      // Filter applications (exclude paid bookings since they belong in confirmed speakers)
      const applications = allBookings.filter(
        (booking) => booking.status !== "paid"
      );
      setEventBookings(applications);

      // Filter confirmed speakers for this event (accepted or paid)
      const confirmed = allBookings.filter(
        (booking) => booking.status === "accepted" || booking.status === "paid"
      );
      setEventConfirmedSpeakers(confirmed);
    } catch (error) {
      console.error("Error fetching event bookings:", error);
      toast({
        title: "Error loading applications",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setBookingLoading(false);
    }
  };

  const fetchEventConfirmedSpeakers = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          *,
          speaker:speakers!speaker_id(
            id,
            hourly_rate,
            experience_level,
            average_rating,
            total_talks,
            profile:profiles!profile_id(full_name, avatar_url, bio, location)
          ),
          event:events!event_id(id, title, date_time, location, format, duration_hours)
        `
        )
        .eq("event_id", eventId)
        .in("status", ["accepted", "paid"])
        .order("created_at", { ascending: false });

      if (error) throw error;
      setEventConfirmedSpeakers(data || []);
    } catch (error) {
      console.error("Error fetching event confirmed speakers:", error);
    }
  };

  const handleBookingAction = async (
    bookingId: string,
    action: "accepted" | "rejected"
  ) => {
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: action })
        .eq("id", bookingId);

      if (error) throw error;

      toast({
        title: `Application ${action}`,
        description: `The speaker application has been ${action}.`,
      });

      // Refresh bookings and confirmed speakers
      fetchMyBookings();
      fetchConfirmedSpeakers();
      if (selectedEvent) {
        fetchEventBookings(selectedEvent);
        fetchEventConfirmedSpeakers(selectedEvent);
      }
    } catch (error) {
      console.error("Error updating booking:", error);
      toast({
        title: "Error updating application",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  const filteredEvents = events.filter((event) => {
    const matchesSearch =
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "all" || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getEventApplicationCount = (eventId: string) => {
    return bookings.filter((booking) => booking.event.id === eventId).length;
  };

  const getConfirmedSpeakersCount = (eventId: string) => {
    return confirmedSpeakers.filter((booking) => booking.event.id === eventId)
      .length;
  };

  const getPendingApplicationCount = (eventId: string) => {
    return bookings.filter(
      (booking) => booking.event.id === eventId && booking.status === "pending"
    ).length;
  };

  const getConfirmedBookingsForEvent = (eventId: string) => {
    return confirmedSpeakers.filter((booking) => booking.event.id === eventId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBudget = (min?: number, max?: number) => {
    if (!min && !max) return "Budget not specified";
    if (min && max)
      return `Rp${min.toLocaleString("id-ID")} - Rp${max.toLocaleString(
        "id-ID"
      )}`;
    if (min) return `From Rp${min.toLocaleString("id-ID")}`;
    if (max) return `Up to Rp${max.toLocaleString("id-ID")}`;
    return "Budget not specified";
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <span
        key={index}
        className={`text-lg ${
          index < Math.floor(rating) ? "text-yellow-400" : "text-gray-300"
        }`}
      >
        ★
      </span>
    ));
  };

  // Render interactive stars for rating selection
  const renderInteractiveStars = (currentRating: number, onRatingChange: (rating: number) => void) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-6 w-6 cursor-pointer transition-colors ${
          index < currentRating
            ? "text-yellow-400 fill-current"
            : "text-gray-300 hover:text-yellow-200"
        }`}
        onClick={() => onRatingChange(index + 1)}
      />
    ));
  };

  // Handle review submission
  const handleSubmitReview = async () => {
    if (!selectedSpeaker) return;

    setReviewLoading(true);
    try {
      // Update the booking with organizer feedback and rating
      const { error } = await supabase
        .from("bookings")
        .update({
          organizer_feedback: reviewForm.feedback,
          organizer_rating: reviewForm.rating,
        })
        .eq("id", selectedSpeaker.bookingId);

      if (error) throw error;

      toast({
        title: "Review submitted successfully!",
        description: `Thank you for reviewing ${selectedSpeaker.speakerName}`,
      });

      // Reset form and close dialog
      setReviewForm({ rating: 5, feedback: "" });
      setShowReviewDialog(false);
      setSelectedSpeaker(null);

      // Refresh the data
      fetchConfirmedSpeakers();
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error submitting review",
        description: "Please try again later",
        variant: "destructive",
      });
    } finally {
      setReviewLoading(false);
    }
  };

  // Open review dialog for a speaker
  const openReviewDialog = (speaker: any, eventTitle: string) => {
    setSelectedSpeaker({
      speakerId: speaker.speaker.id,
      speakerName: speaker.speaker.profile.full_name,
      eventTitle: eventTitle,
      bookingId: speaker.id,
    });
    setShowReviewDialog(true);
  };

  // Mark event as finished
  const markEventAsFinished = async (eventId: string) => {
    try {
      const { error } = await supabase
        .from("events")
        .update({ status: "finished" })
        .eq("id", eventId);

      if (error) throw error;

      toast({
        title: "Event marked as finished",
        description: "The event has been moved to the completed tab",
      });

      // Refresh events
      fetchMyEvents();
    } catch (error) {
      console.error("Error marking event as finished:", error);
      toast({
        title: "Error updating event",
        description: "Please try again later",
        variant: "destructive",
      });
    }
  };

  // Load topics for event creation
  const loadTopics = async () => {
    try {
      const { data, error } = await supabase
        .from("topics")
        .select("*")
        .order("name");

      if (error) throw error;
      setTopics(data || []);
    } catch (error) {
      console.error("Error loading topics:", error);
    }
  };

  // Handle topic toggle for event creation
  const handleTopicToggle = (topicName: string) => {
    setEventForm((prev) => ({
      ...prev,
      required_topics: prev.required_topics.includes(topicName)
        ? prev.required_topics.filter((t) => t !== topicName)
        : [...prev.required_topics, topicName],
    }));
  };

  // Handle event creation
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile) return;

    setCreateLoading(true);

    try {
      // Get the user's profile ID
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      // Create the event
      const { error } = await supabase.from("events").insert({
        organizer_id: profile.id,
        title: eventForm.title,
        description: eventForm.description,
        event_type: eventForm.event_type,
        format: eventForm.format,
        location: eventForm.location || null,
        date_time: new Date(eventForm.date_time).toISOString(),
        duration_hours: parseInt(eventForm.duration_hours),
        budget_min: eventForm.budget_min
          ? parseInt(eventForm.budget_min)
          : null, // Store in Rupiah directly
        budget_max: eventForm.budget_max
          ? parseInt(eventForm.budget_max)
          : null, // Store in Rupiah directly
        required_topics: eventForm.required_topics,
        status: "open",
      });

      if (error) throw error;

      toast({
        title: "Event created!",
        description: "Your event has been posted successfully.",
      });

      // Reset form and close dialog
      setEventForm({
        title: "",
        description: "",
        event_type: "lecture",
        format: "in-person",
        location: "",
        date_time: "",
        duration_hours: "",
        budget_min: "",
        budget_max: "",
        required_topics: [],
      });
      setShowCreateDialog(false);

      // Refresh events list
      fetchMyEvents();
    } catch (error) {
      console.error("Error creating event:", error);
      toast({
        title: "Error",
        description: "Failed to create event. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreateLoading(false);
    }
  };

  const canCreateEvents =
    userProfile?.user_type === "organizer" || userProfile?.user_type === "both";

  // Check if user has access to this page
  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">
            Authentication Required
          </h3>
          <p className="text-muted-foreground mb-4">
            Please sign in to view your events.
          </p>
          <Button onClick={() => (window.location.href = "/auth")}>
            Sign In
          </Button>
        </div>
      </div>
    );
  }

  if (
    userProfile &&
    userProfile.user_type !== "organizer" &&
    userProfile.user_type !== "both"
  ) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Access Restricted</h3>
          <p className="text-muted-foreground mb-4">
            This page is only available to event organizers. You need to have an
            organizer account to manage events.
          </p>
          <Button onClick={() => (window.location.href = "/events")}>
            Browse Events
          </Button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your events...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">My Events Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your events, review speaker applications, and track
                confirmed speakers
              </p>
            </div>
            {user && canCreateEvents && (
              <Dialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
              >
                <DialogTrigger asChild>
                  <Button size="lg" className="w-full sm:w-auto">
                    <Plus className="mr-2 h-5 w-5" />
                    Post New Event
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Create New Event</DialogTitle>
                    <DialogDescription>
                      Post a new speaking opportunity for the community
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateEvent} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Event Title *</Label>
                      <Input
                        id="title"
                        value={eventForm.title}
                        onChange={(e) =>
                          setEventForm({ ...eventForm, title: e.target.value })
                        }
                        placeholder="e.g., Tech Innovation Conference 2025"
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Description *</Label>
                      <Textarea
                        id="description"
                        value={eventForm.description}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            description: e.target.value,
                          })
                        }
                        placeholder="Describe your event and what you're looking for in a speaker..."
                        rows={3}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="event-type">Event Type *</Label>
                        <Select
                          value={eventForm.event_type}
                          onValueChange={(value) =>
                            setEventForm({
                              ...eventForm,
                              event_type: value as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lecture">Lecture</SelectItem>
                            <SelectItem value="seminar">Seminar</SelectItem>
                            <SelectItem value="workshop">Workshop</SelectItem>
                            <SelectItem value="webinar">Webinar</SelectItem>
                            <SelectItem value="conference">
                              Conference
                            </SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="format">Format *</Label>
                        <Select
                          value={eventForm.format}
                          onValueChange={(value) =>
                            setEventForm({
                              ...eventForm,
                              format: value as any,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select format" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="in-person">In-Person</SelectItem>
                            <SelectItem value="virtual">Virtual</SelectItem>
                            <SelectItem value="hybrid">Hybrid</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={eventForm.location}
                        onChange={(e) =>
                          setEventForm({
                            ...eventForm,
                            location: e.target.value,
                          })
                        }
                        placeholder="e.g., New York City, NY or Online"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="date-time">Date & Time *</Label>
                        <Input
                          id="date-time"
                          type="datetime-local"
                          value={eventForm.date_time}
                          onChange={(e) =>
                            setEventForm({
                              ...eventForm,
                              date_time: e.target.value,
                            })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (hours) *</Label>
                        <Input
                          id="duration"
                          type="number"
                          min="0.5"
                          step="0.5"
                          value={eventForm.duration_hours}
                          onChange={(e) =>
                            setEventForm({
                              ...eventForm,
                              duration_hours: e.target.value,
                            })
                          }
                          placeholder="e.g., 2"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="budget-min">Budget Min (IDR)</Label>
                        <Input
                          id="budget-min"
                          type="number"
                          min="0"
                          value={eventForm.budget_min}
                          onChange={(e) =>
                            setEventForm({
                              ...eventForm,
                              budget_min: e.target.value,
                            })
                          }
                          placeholder="e.g., 500000"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="budget-max">Budget Max (IDR)</Label>
                        <Input
                          id="budget-max"
                          type="number"
                          min="0"
                          value={eventForm.budget_max}
                          onChange={(e) =>
                            setEventForm({
                              ...eventForm,
                              budget_max: e.target.value,
                            })
                          }
                          placeholder="e.g., 2000000"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Required Topics</Label>
                      <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto border rounded-md p-3">
                        {topics.map((topic) => (
                          <label
                            key={topic.id}
                            className="flex items-center space-x-2 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={eventForm.required_topics.includes(
                                topic.name
                              )}
                              onChange={() => handleTopicToggle(topic.name)}
                              className="rounded"
                            />
                            <span className="text-sm">{topic.name}</span>
                          </label>
                        ))}
                      </div>
                      {eventForm.required_topics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {eventForm.required_topics.map((topic, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {topic}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowCreateDialog(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={createLoading}
                        className="flex-1"
                      >
                        {createLoading && (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        )}
                        Create Event
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        <Tabs defaultValue="events" className="space-y-6">
          <TabsList>
            <TabsTrigger value="events">
              My Events ({events.length})
            </TabsTrigger>
            <TabsTrigger value="applications">
              All Applications ({bookings.length})
            </TabsTrigger>
            <TabsTrigger value="confirmed">
              Confirmed Speakers ({confirmedSpeakers.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Completed Events (
              {
                events.filter(
                  (e) => e.status === "completed" || e.status === "finished"
                ).length
              }
              )
            </TabsTrigger>
          </TabsList>

          <TabsContent value="events" className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Event Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="finished">Finished</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground flex items-center">
                {filteredEvents.length} events found
              </div>
            </div>

            {/* Events Grid */}
            {filteredEvents.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No events found</h3>
                <p className="text-muted-foreground">
                  You haven't created any events yet, or no events match your
                  filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((event) => (
                  <Card
                    key={event.id}
                    className="h-full flex flex-col hover:shadow-lg transition-shadow"
                  >
                    <Link
                      to={`/events/${event.id}`}
                      className="flex-1 flex flex-col cursor-pointer"
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <Badge
                            variant={
                              event.status === "open"
                                ? "default"
                                : event.status === "finished"
                                ? "default"
                                : "secondary"
                            }
                            className={`mb-2 ${
                              event.status === "finished"
                                ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100"
                                : ""
                            }`}
                          >
                            {event.status.replace("_", " ")}
                          </Badge>
                          <Badge variant="outline">{event.format}</Badge>
                        </div>
                        <CardTitle className="line-clamp-2 hover:text-primary transition-colors">
                          {event.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3">
                          {event.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-1">
                        <div className="space-y-3 mb-4">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Calendar className="mr-2 h-4 w-4" />
                            {formatDate(event.date_time)}
                          </div>
                          <div className="flex items-center text-sm text-muted-foreground">
                            <Clock className="mr-2 h-4 w-4" />
                            {event.duration_hours} hour
                            {event.duration_hours !== 1 ? "s" : ""}
                          </div>
                          {event.location && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <MapPin className="mr-2 h-4 w-4" />
                              {event.location}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <DollarSign className="mr-2 h-4 w-4" />
                          {formatBudget(event.budget_min, event.budget_max)}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Users className="mr-2 h-4 w-4" />
                          {getEventApplicationCount(event.id)} applications
                          {getPendingApplicationCount(event.id) > 0 && (
                            <Badge
                              variant="destructive"
                              className="ml-2 text-xs"
                            >
                              {getPendingApplicationCount(event.id)} pending
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <CheckCircle className="mr-2 h-4 w-4" />
                          {getConfirmedSpeakersCount(event.id)} confirmed
                          speakers
                        </div>
                      </CardContent>
                    </Link>

                    {/* Action buttons - outside of Link to remain interactive */}
                    <CardContent className="pt-0">
                      <div className="pt-4 border-t">
                        <div className="space-y-2">
                          <Dialog
                            onOpenChange={(open) => {
                              if (open) {
                                setSelectedEvent(event.id);
                                fetchEventBookings(event.id);
                                fetchEventConfirmedSpeakers(event.id);
                              } else {
                                setSelectedEvent(null);
                                setEventBookings([]);
                                setEventConfirmedSpeakers([]);
                              }
                            }}
                          >
                            <DialogTrigger asChild>
                              <Button className="w-full">
                                <Users className="mr-2 h-4 w-4" />
                                View Applications (
                                {getEventApplicationCount(event.id)})
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>
                                  "{event.title}" - Applications & Speakers
                                </DialogTitle>
                                <DialogDescription>
                                  Review applications and manage confirmed
                                  speakers for this event
                                </DialogDescription>
                              </DialogHeader>

                              <Tabs
                                defaultValue="applications"
                                className="space-y-4"
                              >
                                <TabsList className="grid w-full grid-cols-2">
                                  <TabsTrigger value="applications">
                                    Applications ({eventBookings.length})
                                  </TabsTrigger>
                                  <TabsTrigger value="speakers">
                                    Confirmed Speakers (
                                    {eventConfirmedSpeakers.length})
                                  </TabsTrigger>
                                </TabsList>

                                <TabsContent value="applications">
                                  {bookingLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="h-8 w-8 animate-spin" />
                                    </div>
                                  ) : eventBookings.length === 0 ? (
                                    <div className="text-center py-8">
                                      <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                      <p className="text-muted-foreground">
                                        No applications yet for this event.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="max-h-96 overflow-y-auto space-y-4">
                                      {eventBookings.map((booking) => (
                                        <Card key={booking.id}>
                                          <CardContent className="p-4">
                                            <div className="flex items-start space-x-4">
                                              <Avatar className="h-12 w-12">
                                                <AvatarImage
                                                  src={
                                                    booking.speaker.profile
                                                      .avatar_url
                                                  }
                                                />
                                                <AvatarFallback>
                                                  {booking.speaker.profile.full_name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                  <h4 className="font-semibold">
                                                    {
                                                      booking.speaker.profile
                                                        .full_name
                                                    }
                                                  </h4>
                                                  <Badge
                                                    variant={
                                                      booking.status ===
                                                      "pending"
                                                        ? "outline"
                                                        : booking.status ===
                                                          "accepted"
                                                        ? "default"
                                                        : "destructive"
                                                    }
                                                  >
                                                    {booking.status}
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                                                  <span>
                                                    {
                                                      booking.speaker
                                                        .experience_level
                                                    }
                                                  </span>
                                                  <span>
                                                    {
                                                      booking.speaker
                                                        .total_talks
                                                    }{" "}
                                                    talks
                                                  </span>
                                                  <div className="flex items-center">
                                                    {renderStars(
                                                      booking.speaker
                                                        .average_rating
                                                    )}
                                                    <span className="ml-1">
                                                      (
                                                      {booking.speaker.average_rating.toFixed(
                                                        1
                                                      )}
                                                      )
                                                    </span>
                                                  </div>
                                                </div>
                                                {booking.speaker.profile
                                                  .location && (
                                                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                                                    <MapPin className="mr-1 h-3 w-3" />
                                                    {
                                                      booking.speaker.profile
                                                        .location
                                                    }
                                                  </div>
                                                )}
                                                {booking.message && (
                                                  <div className="mt-2">
                                                    <p className="text-sm font-medium mb-1">
                                                      Message:
                                                    </p>
                                                    <p className="text-sm text-muted-foreground">
                                                      {booking.message}
                                                    </p>
                                                  </div>
                                                )}
                                                {(booking.speaker.hourly_rate ||
                                                  booking.agreed_rate) &&
                                                  booking.event
                                                    .duration_hours && (
                                                    <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                                                      <div className="text-sm space-y-1">
                                                        {booking.agreed_rate &&
                                                        booking.agreed_rate >
                                                          0 ? (
                                                          <>
                                                            <div className="flex justify-between">
                                                              <span className="text-blue-600 font-medium">
                                                                Proposed Rate:
                                                              </span>
                                                              <span className="text-blue-600 font-medium">
                                                                Rp
                                                                {booking.agreed_rate.toLocaleString(
                                                                  "id-ID"
                                                                )}
                                                                /hour
                                                              </span>
                                                            </div>
                                                            <div className="flex justify-between text-gray-500">
                                                              <span>
                                                                Speaker's
                                                                Default Rate:
                                                              </span>
                                                              <span>
                                                                Rp
                                                                {(
                                                                  booking
                                                                    .speaker
                                                                    .hourly_rate ||
                                                                  0
                                                                ).toLocaleString(
                                                                  "id-ID"
                                                                )}
                                                                /hour
                                                              </span>
                                                            </div>
                                                          </>
                                                        ) : (
                                                          <div className="flex justify-between">
                                                            <span>
                                                              Hourly Rate:
                                                            </span>
                                                            <span>
                                                              Rp
                                                              {(
                                                                booking.speaker
                                                                  .hourly_rate ||
                                                                0
                                                              ).toLocaleString(
                                                                "id-ID"
                                                              )}
                                                              /hour
                                                            </span>
                                                          </div>
                                                        )}
                                                        <div className="flex justify-between">
                                                          <span>
                                                            Event Duration:
                                                          </span>
                                                          <span>
                                                            {
                                                              booking.event
                                                                .duration_hours
                                                            }{" "}
                                                            hours
                                                          </span>
                                                        </div>
                                                        <div className="border-t pt-1 flex justify-between font-medium">
                                                          <span>
                                                            Total Payment:
                                                          </span>
                                                          <span
                                                            className={
                                                              booking.agreed_rate &&
                                                              booking.agreed_rate >
                                                                0
                                                                ? "text-blue-600"
                                                                : ""
                                                            }
                                                          >
                                                            Rp
                                                            {(
                                                              (booking.agreed_rate &&
                                                              booking.agreed_rate >
                                                                0
                                                                ? booking.agreed_rate
                                                                : booking
                                                                    .speaker
                                                                    .hourly_rate ||
                                                                  0) *
                                                              booking.event
                                                                .duration_hours
                                                            ).toLocaleString(
                                                              "id-ID"
                                                            )}
                                                          </span>
                                                        </div>
                                                        {booking.agreed_rate &&
                                                          booking.agreed_rate >
                                                            0 && (
                                                            <div className="text-xs text-blue-600 mt-1">
                                                              Using speaker's
                                                              proposed rate
                                                            </div>
                                                          )}
                                                      </div>
                                                    </div>
                                                  )}
                                                <div className="flex space-x-2 mt-4">
                                                  <Link
                                                    to={`/speakers/${booking.speaker.id}`}
                                                  >
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                    >
                                                      <User className="mr-1 h-4 w-4" />
                                                      View Profile
                                                    </Button>
                                                  </Link>
                                                  <Link
                                                    to={`/events/${booking.event.id}`}
                                                  >
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                    >
                                                      <Eye className="mr-1 h-4 w-4" />
                                                      View Event
                                                    </Button>
                                                  </Link>
                                                  {booking.status ===
                                                    "pending" && (
                                                    <>
                                                      <Button
                                                        size="sm"
                                                        onClick={() =>
                                                          handleBookingAction(
                                                            booking.id,
                                                            "accepted"
                                                          )
                                                        }
                                                      >
                                                        <CheckCircle className="mr-1 h-4 w-4" />
                                                        Accept
                                                      </Button>
                                                      <Button
                                                        size="sm"
                                                        variant="destructive"
                                                        onClick={() =>
                                                          handleBookingAction(
                                                            booking.id,
                                                            "rejected"
                                                          )
                                                        }
                                                      >
                                                        <XCircle className="mr-1 h-4 w-4" />
                                                        Reject
                                                      </Button>
                                                    </>
                                                  )}
                                                  {booking.status ===
                                                    "accepted" && (
                                                    <Link
                                                      to={`/payment/${booking.id}`}
                                                    >
                                                      <Button
                                                        size="sm"
                                                        variant="default"
                                                      >
                                                        <CreditCard className="mr-1 h-4 w-4" />
                                                        Pay Speaker
                                                      </Button>
                                                    </Link>
                                                  )}
                                                  {booking.status ===
                                                    "paid" && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled
                                                    >
                                                      <CheckCircle className="mr-1 h-4 w-4" />
                                                      Payment Completed
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>

                                <TabsContent value="speakers">
                                  {eventConfirmedSpeakers.length === 0 ? (
                                    <div className="text-center py-8">
                                      <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                                      <p className="text-muted-foreground">
                                        No confirmed speakers for this event
                                        yet.
                                      </p>
                                    </div>
                                  ) : (
                                    <div className="max-h-96 overflow-y-auto space-y-4">
                                      {eventConfirmedSpeakers.map((booking) => (
                                        <Card key={booking.id}>
                                          <CardContent className="p-4">
                                            <div className="flex items-start space-x-4">
                                              <Avatar className="h-12 w-12">
                                                <AvatarImage
                                                  src={
                                                    booking.speaker.profile
                                                      .avatar_url
                                                  }
                                                />
                                                <AvatarFallback>
                                                  {booking.speaker.profile.full_name
                                                    .charAt(0)
                                                    .toUpperCase()}
                                                </AvatarFallback>
                                              </Avatar>
                                              <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-2">
                                                  <h4 className="font-semibold">
                                                    {
                                                      booking.speaker.profile
                                                        .full_name
                                                    }
                                                  </h4>
                                                  <Badge variant="default">
                                                    <CheckCircle className="mr-1 h-3 w-3" />
                                                    Confirmed
                                                  </Badge>
                                                </div>
                                                <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                                                  <span>
                                                    {
                                                      booking.speaker
                                                        .experience_level
                                                    }
                                                  </span>
                                                  <span>
                                                    {
                                                      booking.speaker
                                                        .total_talks
                                                    }{" "}
                                                    talks
                                                  </span>
                                                  <div className="flex items-center">
                                                    {renderStars(
                                                      booking.speaker
                                                        .average_rating
                                                    )}
                                                    <span className="ml-1">
                                                      (
                                                      {booking.speaker.average_rating.toFixed(
                                                        1
                                                      )}
                                                      )
                                                    </span>
                                                  </div>
                                                </div>
                                                {booking.speaker.profile
                                                  .location && (
                                                  <div className="flex items-center text-sm text-muted-foreground mb-2">
                                                    <MapPin className="mr-1 h-3 w-3" />
                                                    {
                                                      booking.speaker.profile
                                                        .location
                                                    }
                                                  </div>
                                                )}
                                                {booking.agreed_rate && (
                                                  <div className="mt-2 text-sm">
                                                    <span className="font-medium">
                                                      Agreed Rate:{" "}
                                                    </span>
                                                    Rp
                                                    {booking.agreed_rate.toLocaleString(
                                                      "id-ID"
                                                    )}
                                                    /hour
                                                  </div>
                                                )}
                                                <div className="flex space-x-2 mt-4">
                                                  <Link
                                                    to={`/speakers/${booking.speaker.id}`}
                                                  >
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                    >
                                                      <User className="mr-1 h-4 w-4" />
                                                      View Profile
                                                    </Button>
                                                  </Link>
                                                  {booking.status ===
                                                    "accepted" && (
                                                    <Link
                                                      to={`/payment/${booking.id}`}
                                                    >
                                                      <Button
                                                        size="sm"
                                                        variant="default"
                                                      >
                                                        <CreditCard className="mr-1 h-4 w-4" />
                                                        Pay Speaker
                                                      </Button>
                                                    </Link>
                                                  )}
                                                  {booking.status ===
                                                    "paid" && (
                                                    <Button
                                                      size="sm"
                                                      variant="outline"
                                                      disabled
                                                    >
                                                      <CheckCircle className="mr-1 h-4 w-4" />
                                                      Payment Completed
                                                    </Button>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                          </CardContent>
                                        </Card>
                                      ))}
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>

                          {/* Complete Event Button - only show for paid events that have passed */}
                          {(() => {
                            const confirmedBookings =
                              getConfirmedBookingsForEvent(event.id);
                            const hasConfirmedSpeakers =
                              confirmedBookings.length > 0;
                            const hasPaidBookings = confirmedBookings.some(
                              (booking) => booking.status === "paid"
                            );
                            const eventHasPassed =
                              new Date(event.date_time).getTime() +
                                2 * 60 * 60 * 1000 <
                              Date.now();
                            const hasCompletedEvents = confirmedBookings.some(
                              (booking) => booking.status === "completed"
                            );

                            return (
                              hasConfirmedSpeakers &&
                              hasPaidBookings &&
                              eventHasPassed &&
                              !hasCompletedEvents && (
                                <Button
                                  variant="outline"
                                  className="w-full"
                                  onClick={() => {
                                    const paidBooking = confirmedBookings.find(
                                      (booking) => booking.status === "paid"
                                    );
                                    if (paidBooking) {
                                      navigate(
                                        `/event-completion/${paidBooking.id}`
                                      );
                                    }
                                  }}
                                >
                                  <CheckCircle className="mr-2 h-4 w-4" />
                                  Complete Event
                                </Button>
                              )
                            );
                          })()}

                          {/* Mark as Finished Button - for events that have passed but not marked as finished */}
                          {(() => {
                            const eventHasPassed =
                              new Date(event.date_time).getTime() +
                                2 * 60 * 60 * 1000 <
                              Date.now();
                            const isNotFinished = event.status !== "finished";

                            return (
                              eventHasPassed &&
                              isNotFinished && (
                                <Button
                                  variant="secondary"
                                  className="w-full mt-2"
                                  onClick={() => markEventAsFinished(event.id)}
                                >
                                  <Clock className="mr-2 h-4 w-4" />
                                  Mark as Finished
                                </Button>
                              )
                            );
                          })()}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="applications" className="space-y-6">
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No applications yet
                </h3>
                <p className="text-muted-foreground">
                  You haven't received any speaker applications for your events.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4">
                {bookings.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={booking.speaker.profile.avatar_url}
                          />
                          <AvatarFallback>
                            {booking.speaker.profile.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">
                                {booking.speaker.profile.full_name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Applied for "{booking.event.title}"
                              </p>
                            </div>
                            <Badge
                              variant={
                                booking.status === "pending"
                                  ? "outline"
                                  : booking.status === "accepted"
                                  ? "default"
                                  : booking.status === "paid"
                                  ? "default"
                                  : "destructive"
                              }
                              className={
                                booking.status === "paid"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100"
                                  : ""
                              }
                            >
                              {booking.status}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <span>{booking.speaker.experience_level}</span>
                            <span>{booking.speaker.total_talks} talks</span>
                            <div className="flex items-center">
                              {renderStars(booking.speaker.average_rating)}
                              <span className="ml-1">
                                ({booking.speaker.average_rating.toFixed(1)})
                              </span>
                            </div>
                          </div>
                          {booking.speaker.profile.location && (
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <MapPin className="mr-1 h-3 w-3" />
                              {booking.speaker.profile.location}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground mb-2">
                            Applied on {formatDate(booking.created_at)}
                          </div>
                          {booking.message && (
                            <div className="mt-2">
                              <p className="text-sm font-medium mb-1">
                                Message:
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {booking.message}
                              </p>
                            </div>
                          )}
                          {booking.agreed_rate && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium">
                                Proposed Rate:{" "}
                              </span>
                              Rp{booking.agreed_rate.toLocaleString("id-ID")}
                              /hour
                            </div>
                          )}
                          <div className="flex space-x-2 mt-4">
                            <Link to={`/speakers/${booking.speaker.id}`}>
                              <Button size="sm" variant="outline">
                                <User className="mr-1 h-4 w-4" />
                                View Profile
                              </Button>
                            </Link>
                            <Link to={`/events/${booking.event.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="mr-1 h-4 w-4" />
                                View Event
                              </Button>
                            </Link>
                            {booking.status === "pending" && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleBookingAction(booking.id, "accepted")
                                  }
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Accept
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    handleBookingAction(booking.id, "rejected")
                                  }
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="confirmed" className="space-y-6">
            {confirmedSpeakers.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">
                  No confirmed speakers yet
                </h3>
                <p className="text-muted-foreground">
                  You haven't confirmed any speakers for your events yet.
                </p>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-4">
                {confirmedSpeakers.map((booking) => (
                  <Card key={booking.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start space-x-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage
                            src={booking.speaker.profile.avatar_url}
                          />
                          <AvatarFallback>
                            {booking.speaker.profile.full_name
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h4 className="font-semibold">
                                {booking.speaker.profile.full_name}
                              </h4>
                              <p className="text-sm text-muted-foreground">
                                Speaking at "{booking.event.title}"
                              </p>
                            </div>
                            <Badge
                              variant="default"
                              className={
                                booking.status === "paid"
                                  ? "bg-green-100 text-green-800 hover:bg-green-100 dark:bg-green-900 dark:text-green-100"
                                  : ""
                              }
                            >
                              <CheckCircle className="mr-1 h-3 w-3" />
                              {booking.status === "paid" ? "Paid" : "Confirmed"}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground mb-2">
                            <span>{booking.speaker.experience_level}</span>
                            <span>{booking.speaker.total_talks} talks</span>
                            <div className="flex items-center">
                              {renderStars(booking.speaker.average_rating)}
                              <span className="ml-1">
                                ({booking.speaker.average_rating.toFixed(1)})
                              </span>
                            </div>
                          </div>
                          {booking.speaker.profile.location && (
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <MapPin className="mr-1 h-3 w-3" />
                              {booking.speaker.profile.location}
                            </div>
                          )}
                          {booking.event.date_time && (
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <Calendar className="mr-1 h-3 w-3" />
                              Event: {formatDate(booking.event.date_time)}
                            </div>
                          )}
                          {booking.event.location && (
                            <div className="flex items-center text-sm text-muted-foreground mb-2">
                              <MapPin className="mr-1 h-3 w-3" />
                              {booking.event.location}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground mb-2">
                            Confirmed on {formatDate(booking.created_at)}
                          </div>
                          {booking.message && (
                            <div className="mt-2">
                              <p className="text-sm font-medium mb-1">
                                Speaker's Message:
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {booking.message}
                              </p>
                            </div>
                          )}
                          {booking.agreed_rate && (
                            <div className="mt-2 text-sm">
                              <span className="font-medium">Agreed Rate: </span>
                              Rp{booking.agreed_rate.toLocaleString("id-ID")}
                              /hour
                            </div>
                          )}
                          <div className="flex space-x-2 mt-4">
                            <Link to={`/speakers/${booking.speaker.id}`}>
                              <Button size="sm" variant="outline">
                                <User className="mr-1 h-4 w-4" />
                                View Profile
                              </Button>
                            </Link>
                            <Link to={`/events/${booking.event.id}`}>
                              <Button size="sm" variant="outline">
                                <Eye className="mr-1 h-4 w-4" />
                                View Event
                              </Button>
                            </Link>
                            {booking.status === "accepted" && (
                              <Link to={`/payment/${booking.id}`}>
                                <Button size="sm" variant="default">
                                  <CreditCard className="mr-1 h-4 w-4" />
                                  Pay Speaker
                                </Button>
                              </Link>
                            )}
                            {booking.status === "paid" && (
                              <Button size="sm" variant="outline" disabled>
                                <CheckCircle className="mr-1 h-4 w-4" />
                                Payment Completed
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-6">
            {/* Completed Events Section */}
            {(() => {
              const completedEvents = events.filter(
                (event) =>
                  event.status === "completed" || event.status === "finished"
              );

              return completedEvents.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    No completed events
                  </h3>
                  <p className="text-muted-foreground">
                    Your completed events will appear here once they are
                    finished.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">
                        Completed Events
                      </h3>
                      <p className="text-muted-foreground">
                        Events that have been successfully completed
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-sm">
                      {completedEvents.length} completed
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {completedEvents.map((event) => (
                      <Card key={event.id} className="h-full flex flex-col">
                        <CardHeader>
                          <div className="flex items-start justify-between">
                            <div className="space-y-2">
                              <CardTitle className="text-lg">
                                {event.title}
                              </CardTitle>
                              <div className="flex items-center space-x-2">
                                <Badge
                                  variant={
                                    event.status === "finished"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="capitalize"
                                >
                                  {event.status === "finished"
                                    ? "Finished"
                                    : "Completed"}
                                </Badge>
                                <Badge variant="outline" className="capitalize">
                                  {event.event_type}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="flex-1 flex flex-col justify-between">
                          <div className="space-y-3 mb-4">
                            <CardDescription className="line-clamp-2">
                              {event.description}
                            </CardDescription>

                            <div className="space-y-2 text-sm text-muted-foreground">
                              <div className="flex items-center">
                                <Calendar className="mr-2 h-4 w-4" />
                                {new Date(event.date_time).toLocaleDateString(
                                  "en-US",
                                  {
                                    weekday: "short",
                                    year: "numeric",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </div>
                              {event.location && (
                                <div className="flex items-center">
                                  <MapPin className="mr-2 h-4 w-4" />
                                  {event.location}
                                </div>
                              )}
                              <div className="flex items-center">
                                <Clock className="mr-2 h-4 w-4" />
                                {event.duration_hours} hour
                                {event.duration_hours !== 1 ? "s" : ""}
                              </div>
                              {(event.budget_min || event.budget_max) && (
                                <div className="flex items-center">
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  {event.budget_min && event.budget_max
                                    ? `Rp${event.budget_min.toLocaleString(
                                        "id-ID"
                                      )} - Rp${event.budget_max.toLocaleString(
                                        "id-ID"
                                      )}`
                                    : event.budget_min
                                    ? `From Rp${event.budget_min.toLocaleString(
                                        "id-ID"
                                      )}`
                                    : `Up to Rp${event.budget_max.toLocaleString(
                                        "id-ID"
                                      )}`}
                                </div>
                              )}
                            </div>

                            {event.required_topics.length > 0 && (
                              <div>
                                <p className="text-sm font-medium mb-2">
                                  Required Topics:
                                </p>
                                <div className="flex flex-wrap gap-1">
                                  {event.required_topics
                                    .slice(0, 3)
                                    .map((topic, index) => (
                                      <Badge
                                        key={index}
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {topic}
                                      </Badge>
                                    ))}
                                  {event.required_topics.length > 3 && (
                                    <Badge
                                      variant="outline"
                                      className="text-xs"
                                    >
                                      +{event.required_topics.length - 3} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-3">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-muted-foreground">
                                Completed on:
                              </span>
                              <span className="font-medium">
                                {new Date(event.date_time).toLocaleDateString()}
                              </span>
                            </div>

                            <div className="flex space-x-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex-1"
                                onClick={() => navigate(`/events/${event.id}`)}
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                View Details
                              </Button>
                            </div>

                            {/* Show speakers who can be reviewed */}
                            {(() => {
                              const eventSpeakers = getConfirmedBookingsForEvent(event.id);
                              return eventSpeakers.length > 0 && (
                                <div className="mt-3 pt-3 border-t">
                                  <p className="text-sm font-medium mb-2">Review Speakers:</p>
                                  <div className="space-y-2">
                                    {eventSpeakers.map((speaker) => (
                                      <div key={speaker.id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                        <div className="flex items-center space-x-2">
                                          <div className="text-sm font-medium">
                                            {speaker.speaker.profile.full_name}
                                          </div>
                                          {speaker.organizer_rating && (
                                            <div className="flex items-center">
                                              {renderStars(speaker.organizer_rating)}
                                              <span className="text-xs text-muted-foreground ml-1">
                                                Reviewed
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                        {!speaker.organizer_rating && (
                                          <Button
                                            size="sm"
                                            variant="default"
                                            onClick={() => openReviewDialog(speaker, event.title)}
                                          >
                                            <Star className="mr-1 h-3 w-3" />
                                            Review
                                          </Button>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Review Speaker</DialogTitle>
              <DialogDescription>
                {selectedSpeaker && (
                  <>
                    Rate and review {selectedSpeaker.speakerName} for their performance at "{selectedSpeaker.eventTitle}"
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Rating</Label>
                <div className="flex items-center space-x-1">
                  {renderInteractiveStars(reviewForm.rating, (rating) =>
                    setReviewForm({ ...reviewForm, rating })
                  )}
                  <span className="ml-2 text-sm text-muted-foreground">
                    {reviewForm.rating}/5 stars
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="feedback">Feedback (Optional)</Label>
                <Textarea
                  id="feedback"
                  value={reviewForm.feedback}
                  onChange={(e) =>
                    setReviewForm({ ...reviewForm, feedback: e.target.value })
                  }
                  placeholder="Share your experience working with this speaker..."
                  className="min-h-[100px]"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowReviewDialog(false);
                    setReviewForm({ rating: 5, feedback: "" });
                    setSelectedSpeaker(null);
                  }}
                  className="flex-1"
                  disabled={reviewLoading}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={reviewLoading}
                  className="flex-1"
                >
                  {reviewLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Submit Review
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
};

export default MyEvents;
