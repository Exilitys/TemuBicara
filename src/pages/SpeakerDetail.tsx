import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  MapPin,
  Star,
  Banknote,
  Verified,
  Award,
  ExternalLink,
  ArrowLeft,
  Calendar,
  Users,
  Globe,
  Briefcase,
  Mail,
  MessageSquare,
  UserPlus,
  Loader2,
} from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar-utils";

interface SpeakerDetails {
  id: string;
  experience_level: string;
  hourly_rate?: number;
  available: boolean;
  verified: boolean;
  total_talks: number;
  average_rating: number;
  occupation?: string;
  company?: string;
  primary_topic?: string;
  portfolio_url?: string;
  secondary_location?: string;
  created_at: string;
  profile: {
    full_name: string;
    bio?: string;
    location?: string;
    avatar_url?: string;
    website?: string;
    email: string;
  };
  topics: Array<{
    topic: {
      name: string;
      description?: string;
    };
  }>;
}

interface Review {
  id: string;
  rating: number;
  comment?: string;
  created_at: string;
  event_title?: string; // Added for booking feedback
  source: "reviews" | "bookings"; // Added to track source
  reviewer: {
    full_name: string;
    avatar_url?: string;
  };
}

interface PastEvent {
  id: string;
  title: string;
  event_type: string;
  date_time: string;
  booking_id: string;
  organizer_feedback?: string;
  organizer_rating?: number;
  organizer: {
    full_name: string;
  };
}

const SpeakerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [speaker, setSpeaker] = useState<SpeakerDetails | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<{ user_type: string } | null>(
    null
  );

  // Invitation state
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [userEvents, setUserEvents] = useState<any[]>([]);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    event_id: "",
    message: "",
    offered_rate: "",
  });

  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (id) {
      fetchSpeakerDetails();
      fetchSpeakerReviews();
      fetchPastEvents();
    }
    if (user) {
      fetchUserProfile();
    }

    // Set up real-time subscription to speakers table for this specific speaker
    // This will refresh the speaker details when statistics are updated
    if (id) {
      const speakerSubscription = supabase
        .channel(`speaker-${id}-changes`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "speakers",
            filter: `id=eq.${id}`,
          },
          () => {
            console.log(
              "Speaker statistics updated, refreshing speaker details..."
            );
            fetchSpeakerDetails();
          }
        )
        .subscribe();

      // Also listen for new reviews/ratings for this speaker
      const reviewsSubscription = supabase
        .channel(`speaker-${id}-reviews`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "bookings",
            filter: `speaker_id=eq.${id}`,
          },
          (payload) => {
            // Check if reviewer_notes was updated (new rating/feedback)
            if (
              payload.new?.reviewer_notes &&
              payload.new.reviewer_notes !== payload.old?.reviewer_notes
            ) {
              console.log("New rating/feedback added, refreshing reviews...");
              fetchSpeakerReviews();
            }
          }
        )
        .subscribe();

      // Listen for profile updates (including avatar changes)
      const profilesSubscription = supabase
        .channel(`speaker-${id}-profile`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
          },
          () => {
            console.log(
              "Profile updated (including avatar), refreshing speaker details..."
            );
            fetchSpeakerDetails();
          }
        )
        .subscribe();

      // Listen for custom avatar update events
      const handleAvatarUpdate = () => {
        console.log(
          "Avatar updated event received, refreshing speaker details..."
        );
        fetchSpeakerDetails();
      };

      window.addEventListener("avatarUpdated", handleAvatarUpdate);

      return () => {
        speakerSubscription.unsubscribe();
        reviewsSubscription.unsubscribe();
        profilesSubscription.unsubscribe();
        window.removeEventListener("avatarUpdated", handleAvatarUpdate);
      };
    }
  }, [id, user]);

  const fetchSpeakerDetails = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("speakers")
        .select(
          `
          *,
          profile:profiles!profile_id(full_name, bio, location, avatar_url, website, email),
          topics:speaker_topics(topic:topics(name, description))
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;
      setSpeaker(data);
    } catch (error) {
      console.error("Error fetching speaker details:", error);
      toast({
        title: "Error loading speaker",
        description: "Speaker not found or unable to load details",
        variant: "destructive",
      });
      navigate("/speakers");
    } finally {
      setLoading(false);
    }
  };

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

  const fetchSpeakerReviews = async () => {
    if (!id) return;

    try {
      // Fetch reviews from the reviews table
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select(
          `
          id,
          rating,
          comment,
          created_at,
          reviewer:profiles!reviewer_id(full_name, avatar_url)
        `
        )
        .eq("reviewee_id", id)
        .order("created_at", { ascending: false });

      // Fetch feedback from bookings table (our actual event feedback)
      const { data: bookingFeedback, error: bookingError } = await supabase
        .from("bookings")
        .select(
          `
          id,
          reviewer_notes,
          updated_at,
          event:events(title),
          event:events(organizer:profiles!events_organizer_id_fkey(full_name, avatar_url))
        `
        )
        .eq("speaker_id", id)
        .not("reviewer_notes", "is", null)
        .order("updated_at", { ascending: false });

      const combinedReviews: Review[] = [];

      // Add reviews from reviews table
      if (reviewsData && !reviewsError) {
        const formattedReviews = reviewsData.map((review) => ({
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          created_at: review.created_at,
          source: "reviews" as const,
          reviewer: review.reviewer,
        }));
        combinedReviews.push(...formattedReviews);
      }

      // Add feedback from bookings table
      if (bookingFeedback && !bookingError) {
        const formattedBookingFeedback = bookingFeedback.map((booking) => {
          // Extract rating and feedback from reviewer_notes
          // Handle different formats of reviewer_notes
          let rating = 5; // default rating
          let comment = booking.reviewer_notes;

          // Check if it's in the "Rating: X/5 stars. Feedback: ..." format
          const structuredRatingMatch = booking.reviewer_notes.match(
            /Rating: (\d+)\/5 stars/
          );
          const structuredFeedbackMatch =
            booking.reviewer_notes.match(/Feedback: (.+)$/);

          if (structuredRatingMatch) {
            rating = parseInt(structuredRatingMatch[1]);
            if (structuredFeedbackMatch) {
              comment = structuredFeedbackMatch[1].trim();
            } else {
              // If there's no "Feedback:" part, just show the whole text after the rating
              const afterRating = booking.reviewer_notes.replace(
                /Rating: \d+\/5 stars\.?\s*/,
                ""
              );
              comment = afterRating || "No additional feedback provided";
            }
          }

          return {
            id: `booking-${booking.id}`,
            rating: rating,
            comment: comment,
            created_at: booking.updated_at,
            event_title: (booking.event as any)?.title || "Unknown Event",
            source: "bookings" as const,
            reviewer: (booking.event as any)?.organizer || {
              full_name: "Event Organizer",
              avatar_url: null,
            },
          };
        });
        combinedReviews.push(...formattedBookingFeedback);
      }

      // Sort all reviews by date (newest first)
      combinedReviews.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setReviews(combinedReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    }
  };

  const fetchPastEvents = async () => {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          `
          id,
          organizer_feedback,
          organizer_rating,
          event:events!event_id(
            id,
            title,
            event_type,
            date_time,
            organizer:profiles!organizer_id(full_name)
          )
        `
        )
        .eq("speaker_id", id)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error && error.code !== "PGRST116") throw error;

      // Extract events from the nested structure and include feedback data
      const eventsWithFeedback =
        data?.map((booking: any) => ({
          ...booking.event,
          booking_id: booking.id,
          organizer_feedback: booking.organizer_feedback,
          organizer_rating: booking.organizer_rating,
        })).filter(Boolean) || [];
      setPastEvents(eventsWithFeedback);
    } catch (error) {
      console.error("Error fetching past events:", error);
    }
  };

  const formatRate = (rate?: number) => {
    if (!rate) return "Rate not specified";
    return `Rp${rate.toLocaleString("id-ID")}/hour`;
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, index) => (
      <Star
        key={index}
        className={`h-4 w-4 ${
          index < Math.floor(rating)
            ? "text-yellow-400 fill-current"
            : "text-gray-300"
        }`}
      />
    ));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const canContactSpeaker =
    userProfile?.user_type === "organizer" || userProfile?.user_type === "both";

  const canInviteSpeaker =
    userProfile?.user_type === "organizer" || userProfile?.user_type === "both";

  const fetchUserEvents = async () => {
    if (!user || !canInviteSpeaker) return;

    try {
      // First get the user's profile ID
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      console.log("Profile data:", profileData);

      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, status")
        .eq("organizer_id", profileData.id)
        .gt("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });

      if (error) throw error;

      console.log("All future events:", data);

      // Filter for open events
      const openEvents = data?.filter((event) => event.status === "open") || [];
      console.log("Open events:", openEvents);

      setUserEvents(openEvents);
    } catch (error) {
      console.error("Error fetching user events:", error);
      toast({
        title: "Error loading events",
        description: "Could not load your events for invitation",
        variant: "destructive",
      });
    }
  };

  const handleInviteSpeaker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !speaker || !inviteForm.event_id) return;

    setInviteLoading(true);
    try {
      // Get the user's profile ID for the organizer_id field
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (profileError) throw profileError;

      const { error } = await supabase.from("speaker_invitations").insert({
        event_id: inviteForm.event_id,
        speaker_id: speaker.id,
        organizer_id: profileData.id,
        message: inviteForm.message || null,
        proposed_rate: inviteForm.offered_rate
          ? parseInt(inviteForm.offered_rate)
          : null,
      });

      if (error) throw error;

      toast({
        title: "Invitation sent!",
        description: "Your invitation has been sent to the speaker",
      });

      setShowInviteDialog(false);
      setInviteForm({
        event_id: "",
        message: "",
        offered_rate: "",
      });
    } catch (error: any) {
      console.error("Error sending invitation:", error);
      toast({
        title: "Error sending invitation",
        description:
          error.message ===
          'duplicate key value violates unique constraint "unique_speaker_event_invitation"'
            ? "You have already invited this speaker to this event"
            : "Please try again later",
        variant: "destructive",
      });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleContactSpeaker = () => {
    if (!canContactSpeaker) return;

    // Navigate to chat page
    navigate("/chat");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            Loading speaker details...
          </p>
        </div>
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Speaker not found</h3>
          <p className="text-muted-foreground mb-4">
            The speaker you're looking for doesn't exist or has been removed.
          </p>
          <Button onClick={() => navigate("/speakers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Speakers
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate("/speakers")}
          className="mb-6"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Speakers
        </Button>

        {/* Speaker Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
              <Avatar
                key={speaker.profile?.avatar_url || speaker.id}
                className="h-32 w-32 mx-auto md:mx-0"
              >
                <AvatarImage
                  src={getAvatarUrl(speaker.profile?.avatar_url, speaker.id)}
                  alt={speaker.profile?.full_name}
                />
                <AvatarFallback className="text-4xl">
                  {speaker.profile?.full_name?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center md:text-left">
                <div className="flex items-center justify-center md:justify-start space-x-2 mb-2">
                  <h1 className="text-3xl font-bold">
                    {speaker.profile?.full_name}
                  </h1>
                  {speaker.verified && (
                    <Verified className="h-6 w-6 text-blue-500" />
                  )}
                </div>

                <div className="flex items-center justify-center md:justify-start space-x-2 mb-3">
                  <Badge variant={speaker.available ? "default" : "secondary"}>
                    {speaker.available ? "Available" : "Busy"}
                  </Badge>
                  <Badge variant="outline">{speaker.experience_level}</Badge>
                  {speaker.verified && (
                    <Badge variant="default" className="bg-blue-500">
                      Verified
                    </Badge>
                  )}
                </div>

                {(speaker.occupation || speaker.company) && (
                  <div className="flex items-center justify-center md:justify-start text-lg text-muted-foreground mb-2">
                    <Briefcase className="mr-2 h-4 w-4" />
                    {speaker.occupation && speaker.company
                      ? `${speaker.occupation} at ${speaker.company}`
                      : speaker.occupation || speaker.company}
                  </div>
                )}

                {speaker.profile?.location && (
                  <div className="flex items-center justify-center md:justify-start text-muted-foreground mb-2">
                    <MapPin className="mr-2 h-4 w-4" />
                    {speaker.profile.location}
                    {speaker.secondary_location &&
                      ` • ${speaker.secondary_location}`}
                  </div>
                )}

                {speaker.profile?.website && (
                  <div className="flex items-center justify-center md:justify-start text-muted-foreground mb-4">
                    <Globe className="mr-2 h-4 w-4" />
                    <a
                      href={speaker.profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      {speaker.profile.website}
                    </a>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                  {user && canContactSpeaker ? (
                    <Button
                      onClick={handleContactSpeaker}
                      disabled={!speaker.available}
                      className="flex-1 sm:flex-initial"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      {speaker.available
                        ? "Contact Speaker"
                        : "Currently Unavailable"}
                    </Button>
                  ) : !user ? (
                    <Button
                      onClick={() => navigate("/auth")}
                      className="flex-1 sm:flex-initial"
                    >
                      Sign In to Contact
                    </Button>
                  ) : null}

                  {/* Invite to Event Button */}
                  {user && canInviteSpeaker && (
                    <Dialog
                      open={showInviteDialog}
                      onOpenChange={(open) => {
                        setShowInviteDialog(open);
                        if (open) {
                          fetchUserEvents();
                        } else {
                          setInviteForm({
                            event_id: "",
                            message: "",
                            offered_rate: "",
                          });
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={!speaker.available}
                          className="flex-1 sm:flex-initial"
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Invite to Event
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle>Invite Speaker to Event</DialogTitle>
                          <DialogDescription>
                            Invite {speaker.profile?.full_name} to speak at one
                            of your events
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          onSubmit={handleInviteSpeaker}
                          className="space-y-4"
                        >
                          <div className="space-y-2">
                            <Label htmlFor="event-select">Select Event</Label>
                            <Select
                              value={inviteForm.event_id}
                              onValueChange={(value) =>
                                setInviteForm({
                                  ...inviteForm,
                                  event_id: value,
                                })
                              }
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Choose an event..." />
                              </SelectTrigger>
                              <SelectContent>
                                {userEvents.map((event) => (
                                  <SelectItem key={event.id} value={event.id}>
                                    {event.title} (
                                    {new Date(
                                      event.date_time
                                    ).toLocaleDateString()}
                                    )
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {userEvents.length === 0 && (
                              <p className="text-sm text-muted-foreground">
                                You have no upcoming events. Create an event
                                first to invite speakers.
                              </p>
                            )}
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="message">
                              Personal Message (Optional)
                            </Label>
                            <Textarea
                              id="message"
                              value={inviteForm.message}
                              onChange={(e) =>
                                setInviteForm({
                                  ...inviteForm,
                                  message: e.target.value,
                                })
                              }
                              placeholder="Tell the speaker about your event and why you'd like them to participate..."
                              className="min-h-[100px]"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="offered-rate">
                              Offered Rate (IDR/hour)
                            </Label>
                            <Input
                              id="offered-rate"
                              type="number"
                              min="0"
                              value={inviteForm.offered_rate}
                              onChange={(e) =>
                                setInviteForm({
                                  ...inviteForm,
                                  offered_rate: e.target.value,
                                })
                              }
                              placeholder={`e.g., ${
                                speaker.hourly_rate
                                  ? speaker.hourly_rate.toLocaleString("id-ID")
                                  : "750000"
                              }`}
                            />
                          </div>

                          <div className="flex space-x-3 pt-4">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setShowInviteDialog(false)}
                              className="flex-1"
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              disabled={inviteLoading || !inviteForm.event_id}
                              className="flex-1"
                            >
                              {inviteLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Send Invitation
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  )}

                  {speaker.portfolio_url && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(speaker.portfolio_url, "_blank")
                      }
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View Portfolio
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* About */}
            {speaker.profile?.bio && (
              <Card>
                <CardHeader>
                  <CardTitle>About</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground leading-relaxed">
                    {speaker.profile.bio}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Expertise */}
            {(speaker.primary_topic || speaker.topics.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Expertise</CardTitle>
                  <CardDescription>
                    Topics this speaker can present on
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {speaker.primary_topic && (
                      <div>
                        <h4 className="font-medium mb-2">Primary Topic</h4>
                        <Badge variant="default" className="text-sm">
                          {speaker.primary_topic}
                        </Badge>
                      </div>
                    )}
                    {speaker.topics.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">Additional Topics</h4>
                        <div className="flex flex-wrap gap-2">
                          {speaker.topics.map((topic, index) => (
                            <Badge key={index} variant="outline">
                              {topic.topic.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Past Events */}
            {pastEvents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Speaking Engagements</CardTitle>
                  <CardDescription>
                    Past events where this speaker has presented
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pastEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-4 border rounded-lg"
                      >
                        <div className="flex items-start space-x-4">
                          <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div className="flex-1">
                            <h4 className="font-medium mb-2">{event.title}</h4>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-3">
                              <Badge variant="outline" className="text-xs">
                                {event.event_type}
                              </Badge>
                              <span>•</span>
                              <span>
                                Organized by {event.organizer.full_name}
                              </span>
                              <span>•</span>
                              <span>{formatDate(event.date_time)}</span>
                            </div>
                            
                            {/* Organizer Rating and Feedback */}
                            {(event.organizer_rating || event.organizer_feedback) && (
                              <div className="mt-3 p-3 bg-muted/50 rounded-lg">
                                <div className="flex items-center space-x-2 mb-2">
                                  <span className="text-sm font-medium text-muted-foreground">
                                    Organizer Feedback:
                                  </span>
                                  {event.organizer_rating && (
                                    <div className="flex items-center space-x-1">
                                      {renderStars(event.organizer_rating)}
                                      <span className="text-sm text-muted-foreground ml-1">
                                        ({event.organizer_rating}/5)
                                      </span>
                                    </div>
                                  )}
                                </div>
                                {event.organizer_feedback && (
                                  <p className="text-sm text-muted-foreground italic">
                                    "{event.organizer_feedback}"
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Reviews */}
            {reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Reviews & Feedback</CardTitle>
                  <CardDescription>
                    What organizers say about this speaker's performance
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="p-4 border rounded-lg">
                        <div className="flex items-start space-x-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={review.reviewer.avatar_url} />
                            <AvatarFallback>
                              {review.reviewer.full_name
                                .charAt(0)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-medium text-sm">
                                {review.reviewer.full_name}
                              </span>
                              <div className="flex items-center">
                                {renderStars(review.rating)}
                              </div>
                              {review.source === "bookings" && (
                                <Badge variant="outline" className="text-xs">
                                  Event Feedback
                                </Badge>
                              )}
                            </div>
                            {review.event_title &&
                              review.source === "bookings" && (
                                <p className="text-xs text-blue-600 mb-1">
                                  From event: {review.event_title}
                                </p>
                              )}
                            {review.comment && (
                              <p className="text-sm text-muted-foreground">
                                {review.comment}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDate(review.created_at)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {speaker.total_talks}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Total Talks
                  </div>
                </div>

                <Separator />

                <div className="text-center">
                  <div className="flex items-center justify-center mb-1">
                    {renderStars(speaker.average_rating)}
                  </div>
                  <div className="text-lg font-semibold">
                    {speaker.average_rating.toFixed(1)} / 5.0
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Average Rating
                  </div>
                </div>

                <Separator />

                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {formatRate(speaker.hourly_rate)}
                  </div>
                  <div className="text-sm text-muted-foreground">Rate</div>
                </div>

                <Separator />

                <div className="text-center">
                  <div className="text-sm text-muted-foreground">
                    Member since {formatDate(speaker.created_at)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Speaking Preferences */}
            <Card>
              <CardHeader>
                <CardTitle>Speaking Preferences</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Experience Level</span>
                  <Badge variant="outline" className="capitalize">
                    {speaker.experience_level}
                  </Badge>
                </div>

                {speaker.secondary_location && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Format Preference</span>
                    <Badge variant="outline" className="capitalize">
                      {speaker.secondary_location.replace("_", " ")}
                    </Badge>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-sm">Availability</span>
                  <Badge variant={speaker.available ? "default" : "secondary"}>
                    {speaker.available ? "Available" : "Busy"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpeakerDetail;
